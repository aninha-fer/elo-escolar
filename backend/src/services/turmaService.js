const prisma = require('../prismaClient');
const { criarTurmaDTO, editarTurmaDTO, excluirTurmaDTO } = require('../dtos/turmaDTO');
const { bloquearProfissionalAtivo } = require('./profissionalService');
const { agoraInstituicao, fimMatricula } = require('./encerramentoAtividade');

const filtroMatriculasParaEncerrar = {
    OR: [{ status: 'ATIVO' }, { status: { in: ['PROVISORIO', 'INATIVO'] }, data_fim: null }],
};

async function bloquearTurmaParaEncerramento(tx, id) {
    const matriculas = await tx.matricula_turma.findMany({ where: { turma_id: id, ...filtroMatriculasParaEncerrar }, select: { aluno_id: true } });
    const alunos = new Set(matriculas.map((m) => m.aluno_id));
    // Mantém a ordem aluno → turma usada pelas inscrições e pela edição do aluno.
    for (const alunoId of [...alunos].sort((a, b) => a - b)) await tx.$queryRaw`SELECT "id" FROM "aluno" WHERE "id" = ${alunoId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "turma" WHERE "id" = ${id} FOR UPDATE`;
    const atuais = await tx.matricula_turma.findMany({ where: { turma_id: id, ...filtroMatriculasParaEncerrar } });
    if (atuais.some((m) => !alunos.has(m.aluno_id))) {
        throw Object.assign(new Error('As matrículas da turma mudaram. Confira os vínculos e confirme novamente.'), {
            statusCode: 409, confirmacao: { matriculas: atuais.filter((m) => m.status !== 'INATIVO').map((m) => m.id).sort((a, b) => a - b),
                matriculas_ativas: atuais.filter((m) => m.status === 'ATIVO').length },
            matriculas_ativas: atuais.filter((m) => m.status === 'ATIVO').length,
        });
    }
    return atuais;
}

function validarConfirmacao(matriculas, confirmacao, obrigatoria = false) {
    const ids = matriculas.filter((m) => m.status !== 'INATIVO').map((m) => m.id).sort((a, b) => a - b);
    const ativas = matriculas.filter((m) => m.status === 'ATIVO').length;
    if ((obrigatoria || ids.length || confirmacao) && (JSON.stringify(ids) !== JSON.stringify(confirmacao?.matriculas) || ativas !== confirmacao?.matriculas_ativas)) {
        throw Object.assign(new Error('Confirme o cancelamento das matrículas atuais da turma.'), {
            statusCode: 409, confirmacao: { matriculas: ids, matriculas_ativas: ativas },
            matriculas_ativas: ativas,
        });
    }
}

async function encerrarMatriculasTurma(tx, turma, matriculas) {
    const agora = agoraInstituicao();
    for (const matricula of matriculas) {
        await tx.matricula_turma.update({ where: { id: matricula.id }, data: {
            data_fim: fimMatricula({ ...matricula, turma }, agora),
            ...(matricula.status === 'PROVISORIO' ? {} : { status: 'INATIVO' }),
        } });
    }
}

function gerarHorariosTurma({ tipo, turno, hora_inicio, hora_fim, dias_semana }) {
    const converterHora = (hora) => new Date(`1970-01-01T${hora}:00.000Z`);
    const dias = tipo === 'REGULAR' ? [1, 2, 3, 4, 5] : [...new Set(dias_semana)].sort((a, b) => a - b);
    return dias.map((dia_semana) => {
        const manha = turno === 'MANHA' && dia_semana !== 3;
        return {
            dia_semana,
            hora_inicio: converterHora(tipo === 'REGULAR' ? (manha ? '07:30' : '12:30') : hora_inicio),
            hora_fim: converterHora(tipo === 'REGULAR' ? (manha ? '11:30' : '16:30') : hora_fim),
        };
    });
}

async function listarTurmasService(tipo) {
    const filtro = { deleted_at: null, ...(tipo ? { tipo } : {}) };
    const turmas = await prisma.turma.findMany({
        where: filtro,
        include: {
            horarios: true,
            ambiente: true,
            profissional: {
                include: { pessoa: true }
            },
            _count: {
                select: {
                    matriculas: {
                        where: { status: 'ATIVO' }
                    }
                }
            },
        },
        orderBy: {
            nome: 'asc'
        }
    });
    return turmas.map((turma) => ({
        ...turma,
        vagas_ocupadas: turma._count.matriculas,
        vagas_disponiveis: turma.capacidade_maxima == null ? null : Math.max(turma.capacidade_maxima - turma._count.matriculas, 0),
        _count: undefined,
    }));
}

async function listarTurmasRegularesPorTurnoService(turno) {
    const turmas = await prisma.turma.findMany({
        where: {
            tipo: 'REGULAR',
            deleted_at: null,
            ...(turno ? { turno } : {}),
            status: 'ATIVO'
        },
        include: {
            horarios: true,
            ambiente: true,
            profissional: {
                include: { pessoa: true }
            },
            _count: {
                select: {
                    matriculas: {
                        where: { status: 'ATIVO' }
                    }
                }
            },
        },
        orderBy: {
            nome: 'asc'
        }
    });

    return turmas.map((turma) => ({
        ...turma,
        vagas_ocupadas: turma._count.matriculas,
        vagas_disponiveis: turma.capacidade_maxima == null ? null : Math.max(turma.capacidade_maxima - turma._count.matriculas, 0),
        _count: undefined,
    }));
}

async function criarTurmaService(dadosTurma) {
    const dados = criarTurmaDTO.parse(dadosTurma);
    const { tipo, nome, turno, ambiente_id, capacidade_maxima, ano_letivo, descricao, profissional_id } = dados;
    const horarios = gerarHorariosTurma(dados);

    return prisma.$transaction(async (tx) => {
        const profissional = await bloquearProfissionalAtivo(tx, profissional_id);
        const cargosPermitidos = tipo === 'REGULAR' ? ['professor', 'auxiliar'] : ['professor', 'oficineiro'];
        if (!cargosPermitidos.includes(profissional.cargo.trim().toLocaleLowerCase('pt-BR'))) {
            throw Object.assign(new Error(tipo === 'REGULAR'
                ? 'Selecione um professor ou auxiliar para a turma regular.'
                : 'Selecione um professor ou oficineiro para a oficina.'), { statusCode: 400 });
        }
        if (ambiente_id !== undefined) {
            const ambiente = await tx.ambiente.findUnique({ where: { id: ambiente_id }, select: { id: true } });
            if (!ambiente) {
                throw Object.assign(new Error('Sala não encontrada.'), { statusCode: 404 });
            }
        }

        const turma = await tx.turma.create({
            data: {
                nome, tipo, turno, profissional_id,
                capacidade_maxima: capacidade_maxima ?? null,
                ambiente_id: ambiente_id ?? null,
                descricao: descricao || null,
                ano_letivo: ano_letivo ?? null,
                status: 'ATIVO'
            }
        });
        await tx.turma_horario.createMany({
            data: horarios.map((horario) => ({ ...horario, turma_id: turma.id }))
        });
        return tx.turma.findUnique({ where: { id: turma.id }, include: { horarios: true } });
    }, { isolationLevel: 'ReadCommitted' });
}

async function obterTurmaService(turma_id) {
  const turma = await prisma.turma.findUnique({
    where: { id: turma_id, deleted_at: null },
    select: {
      id: true,
      nome: true,
      tipo: true,
      capacidade_maxima: true,
      turno: true,
      ambiente: { select: { id: true, nome: true } },
      descricao: true,
      profissional: { select: { id: true, cargo: true, pessoa: { select: { nome: true } } } },
      ano_letivo: true,
      status: true,
      _count: { select: { matriculas: true } },
      horarios: {
        select: { id: true, dia_semana: true, hora_inicio: true, hora_fim: true },
        orderBy: [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }, { id: 'asc' }]
      },
      matriculas: {
        where: { status: 'ATIVO', aluno: { deleted_at: null } },
        orderBy: [{ aluno: { pessoa: { nome: 'asc' } } }, { aluno_id: 'asc' }, { id: 'asc' }],
        select: {
          aluno: {
            select: {
              id: true, dias_frequencia: true,
              pessoa: { select: { nome: true } }
            }
          }
        }
      }
    },
  });
  if (!turma) return null;
  const cancelamentos = await prisma.matricula_turma.findMany({
    where: { turma_id, ...filtroMatriculasParaEncerrar }, select: { id: true, status: true },
  });
  const { matriculas, _count, ...dados } = turma;
  return { ...dados, possui_matriculas: (_count?.matriculas ?? matriculas.length) > 0, alunos: matriculas.map((matricula) => matricula.aluno),
    matriculas_ativas: cancelamentos.filter((m) => m.status === 'ATIVO').length,
    confirmacao_cancelamentos: { matriculas: cancelamentos.filter((m) => m.status !== 'INATIVO').map((m) => m.id).sort((a, b) => a - b),
      matriculas_ativas: cancelamentos.filter((m) => m.status === 'ATIVO').length } };
}

async function editarTurmaService(id, entrada) {
    const dados = editarTurmaDTO.parse(entrada);
    return prisma.$transaction(async (tx) => {
        let encerrar;
        if (dados.status === 'INATIVO') encerrar = await bloquearTurmaParaEncerramento(tx, id);
        else await tx.$queryRaw`SELECT "id" FROM "turma" WHERE "id" = ${id} FOR UPDATE`;
        const turma = await tx.turma.findUnique({ where: { id }, include: { horarios: true } });
        if (!turma || turma.deleted_at) throw Object.assign(new Error('Turma não encontrada.'), { statusCode: 404 });
        const matriculas = await tx.matricula_turma.groupBy({ by: ['status', 'data_fim'], where: { turma_id: id }, _count: { _all: true } });
        const possuiMatriculas = matriculas.some((grupo) => grupo._count._all > 0);
        const ocupacao = matriculas.filter((grupo) => grupo.status === 'ATIVO').reduce((total, grupo) => total + grupo._count._all, 0);
        const regular = turma.tipo === 'REGULAR';
        if (regular && ['hora_inicio', 'hora_fim', 'dias_semana'].some((campo) => dados[campo] !== undefined)) {
            throw Object.assign(new Error('O cronograma de turmas regulares é definido pelo turno.'), { statusCode: 400 });
        }
        if (!regular && dados.ano_letivo !== undefined) {
            throw Object.assign(new Error('O ano letivo só pode ser editado em turmas regulares.'), { statusCode: 400 });
        }
        const hora = (valor) => valor.toISOString().slice(11, 16);
        const diasAtuais = [...new Set(turma.horarios.map((h) => h.dia_semana))].sort((a, b) => a - b);
        const novosDias = dados.dias_semana ? [...new Set(dados.dias_semana)].sort((a, b) => a - b) : diasAtuais;
        const mudouTurno = dados.turno !== undefined && dados.turno !== turma.turno;
        const mudouAno = dados.ano_letivo !== undefined && dados.ano_letivo !== turma.ano_letivo;
        const mudouHorario = ['hora_inicio', 'hora_fim'].some((campo) => dados[campo] !== undefined &&
            (!turma.horarios.length || turma.horarios.some((h) => hora(h[campo]) !== dados[campo])));
        const mudouDias = dados.dias_semana !== undefined && JSON.stringify(novosDias) !== JSON.stringify(diasAtuais);
        if (possuiMatriculas && (mudouTurno || mudouAno || mudouHorario || mudouDias)) {
            throw Object.assign(new Error('Turmas com matrículas ou histórico não permitem alterar turno, ano letivo, dias ou horários.'), { statusCode: 409 });
        }
        if (encerrar) validarConfirmacao(encerrar, dados.confirmar_cancelamentos);
        if (dados.capacidade_maxima != null && dados.capacidade_maxima < ocupacao) {
            throw Object.assign(new Error(`A capacidade não pode ser menor que os ${ocupacao} alunos com matrícula ativa.`), { statusCode: 409 });
        }
        if (dados.ambiente_id !== undefined) {
            const sala = await tx.ambiente.findUnique({ where: { id: dados.ambiente_id }, select: { id: true } });
            if (!sala) throw Object.assign(new Error('Sala não encontrada.'), { statusCode: 404 });
        }
        if (dados.profissional_id !== undefined || dados.status === 'ATIVO') {
            const profissional = await bloquearProfissionalAtivo(tx, dados.profissional_id ?? turma.profissional_id);
            const permitido = (regular ? ['professor', 'auxiliar'] : ['professor', 'oficineiro']).includes(profissional.cargo.trim().toLocaleLowerCase('pt-BR'));
            if (!permitido || profissional.pessoa.status_geral !== 'ATIVO') {
                throw Object.assign(new Error('Selecione um profissional ativo com função compatível com a turma.'), { statusCode: 400 });
            }
        }
        const mudouCronograma = mudouTurno || mudouHorario || mudouDias;
        let horarios;
        if (mudouCronograma) {
            const completos = criarTurmaDTO.parse({ ...turma, ...dados,
                hora_inicio: dados.hora_inicio ?? (turma.horarios[0] ? hora(turma.horarios[0].hora_inicio) : undefined),
                hora_fim: dados.hora_fim ?? (turma.horarios[0] ? hora(turma.horarios[0].hora_fim) : undefined),
                dias_semana: novosDias,
            });
            horarios = gerarHorariosTurma(completos);
        }
        const campos = ['nome', 'turno', 'ano_letivo', 'ambiente_id', 'capacidade_maxima', 'descricao', 'profissional_id', 'status'];
        const data = Object.fromEntries(campos.filter((campo) => dados[campo] !== undefined).map((campo) => [campo, dados[campo]]));
        if (encerrar) await encerrarMatriculasTurma(tx, turma, encerrar);
        await tx.turma.update({ where: { id }, data });
        if (horarios) {
            await tx.turma_horario.deleteMany({ where: { turma_id: id } });
            await tx.turma_horario.createMany({ data: horarios.map((h) => ({ ...h, turma_id: id })) });
        }
        return tx.turma.findUnique({ where: { id }, include: { horarios: true, ambiente: { select: { id: true, nome: true } },
            profissional: { select: { id: true, cargo: true, pessoa: { select: { nome: true } } } } } });
    }, { isolationLevel: 'ReadCommitted' });
}

async function excluirTurmaService(id, entrada = {}) {
    const dados = excluirTurmaDTO.parse(entrada);
    return prisma.$transaction(async (tx) => {
        const matriculas = await bloquearTurmaParaEncerramento(tx, id);
        const turma = await tx.turma.findUnique({ where: { id }, include: { horarios: true } });
        if (!turma || turma.deleted_at) throw Object.assign(new Error('Turma não encontrada.'), { statusCode: 404 });
        validarConfirmacao(matriculas, dados.confirmar_cancelamentos, true);
        await encerrarMatriculasTurma(tx, turma, matriculas);
        await tx.turma.update({ where: { id }, data: { status: 'INATIVO', deleted_at: new Date() } });
    }, { isolationLevel: 'ReadCommitted' });
}

module.exports = { listarTurmasService, listarTurmasRegularesPorTurnoService, criarTurmaService, obterTurmaService, editarTurmaService, excluirTurmaService };
