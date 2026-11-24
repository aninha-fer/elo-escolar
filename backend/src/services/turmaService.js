const { bloquearCalendarios, inicioMatriculaRegular, hojeInstituicao, turmaExpirada, comExpiracao } = require('./calendarioLetivo');
const prisma = require('../prismaClient');
const { paginarIds, formatarPagina } = require('./paginacaoService');
const { criarTurmaDTO, editarTurmaDTO, excluirTurmaDTO, criarTurmaAPartirDTO } = require('../dtos/turmaDTO');
const { selectVinculosProfissionais, formatarProfissionaisTurma, validarProfissionaisTurma, atualizarProfissionaisTurma } = require('./turmaProfissionalService');
const { filtroMatriculasParaEncerrar, bloquearTurmaParaEncerramento, encerrarMatriculasTurma, sincronizarTurmasExpiradas } = require('./encerramentoTurmaService');
const { matricularTurmaRegularNaTransacao } = require('./matriculaService');
const { filtroMatriculasAtivas, matriculaVigente } = require('./encerramentoAtividade');

function validarConfirmacao(matriculas, confirmacao, obrigatoria = false) {
    const hoje = hojeInstituicao();
    const vigentes = matriculas.filter((m) => matriculaVigente(m, hoje));
    const ids = vigentes.map((m) => m.id).sort((a, b) => a - b);
    const ativas = vigentes.filter((m) => m.status === 'ATIVO').length;
    if ((obrigatoria || ids.length || confirmacao) && (JSON.stringify(ids) !== JSON.stringify(confirmacao?.matriculas) || ativas !== confirmacao?.matriculas_ativas)) {
        throw Object.assign(new Error('Confirme o cancelamento das matrículas atuais da turma.'), {
            statusCode: 409, confirmacao: { matriculas: ids, matriculas_ativas: ativas },
            matriculas_ativas: ativas,
        });
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

async function listarTurmasService(tipo, paginacao, filtros = {}) {
    if (tipo !== 'OFICINA') await sincronizarTurmasExpiradas();
    const hoje = hojeInstituicao();
    const status = filtros.status ?? paginacao?.status ?? 'TODOS';
    const ano = filtros.ano ?? paginacao?.ano;
    const pagina = paginacao ? await paginarIds('turmas', { ...paginacao, tipo, status, ano }) : null;
    const filtro = { deleted_at: null, ...(tipo ? { tipo } : {}),
        ...(status !== 'TODOS' ? { status } : {}), ...(ano ? { ano_letivo: { ano } } : {}),
        ...(pagina ? { id: { in: pagina.ids } } : {}) };
    const turmas = await prisma.turma.findMany({
        where: filtro,
        include: {
            ano_letivo: true, horarios: true,
            ambiente: true,
            profissionais: selectVinculosProfissionais,
            _count: {
                select: {
                    matriculas: {
                        where: filtroMatriculasAtivas(hoje)
                    }
                }
            },
        },
        orderBy: {
            nome: 'asc'
        }
    });
    return formatarPagina(turmas.map((turma) => ({
        ...comExpiracao(formatarProfissionaisTurma(turma)),
        vagas_ocupadas: turma._count.matriculas,
        vagas_disponiveis: turma.capacidade_maxima == null ? null : Math.max(turma.capacidade_maxima - turma._count.matriculas, 0),
        _count: undefined,
    })), pagina);
}

async function listarTurmasRegularesPorTurnoService(turno) {
    const hoje = hojeInstituicao();
    const turmas = await prisma.turma.findMany({
        where: {
            tipo: 'REGULAR',
            deleted_at: null,
            ...(turno ? { turno } : {}),
            status: 'ATIVO',
            ano_letivo: { data_fim: { gte: hoje } },
        },
        include: {
            ano_letivo: true, horarios: true,
            ambiente: true,
            profissionais: selectVinculosProfissionais,
            _count: {
                select: {
                    matriculas: {
                        where: filtroMatriculasAtivas(hoje)
                    }
                }
            },
        },
        orderBy: {
            nome: 'asc'
        }
    });

    return turmas.map((turma) => ({
        ...formatarProfissionaisTurma(turma),
        vagas_ocupadas: turma._count.matriculas,
        vagas_disponiveis: turma.capacidade_maxima == null ? null : Math.max(turma.capacidade_maxima - turma._count.matriculas, 0),
        _count: undefined,
    }));
}

async function criarTurmaService(dadosTurma) {
    const dados = criarTurmaDTO.parse(dadosTurma);
    return prisma.$transaction(async (tx) => {
        await bloquearCalendarios(tx);
        return criarTurmaNaTransacao(tx, dados);
    }, { isolationLevel: 'ReadCommitted' });
}

async function criarTurmaNaTransacao(tx, dados) {
    const { tipo, nome, turno, ambiente_id, capacidade_maxima, ano_letivo_id, descricao, profissionais_ids } = dados;
    const horarios = gerarHorariosTurma(dados);
    if (ano_letivo_id !== undefined) {
        const calendario = await tx.ano_letivo.findUnique({ where: { id: ano_letivo_id } });
        if (!calendario) throw Object.assign(new Error('Calendário letivo não encontrado.'), { statusCode: 400 });
        if (tipo === 'REGULAR') inicioMatriculaRegular({ nome, ano_letivo: calendario });
    }

    await validarProfissionaisTurma(tx, profissionais_ids);
    if (ambiente_id !== undefined) {
        const ambiente = await tx.ambiente.findUnique({ where: { id: ambiente_id }, select: { id: true } });
        if (!ambiente) {
            throw Object.assign(new Error('Sala não encontrada.'), { statusCode: 404 });
        }
    }

    const turma = await tx.turma.create({
        data: {
            nome, tipo, turno,
            capacidade_maxima: capacidade_maxima ?? null,
            ambiente_id: ambiente_id ?? null,
            descricao: descricao || null,
            ano_letivo_id: ano_letivo_id ?? null,
            status: 'ATIVO'
        }
    });
    await atualizarProfissionaisTurma(tx, turma.id, profissionais_ids);
    await tx.turma_horario.createMany({
        data: horarios.map((horario) => ({ ...horario, turma_id: turma.id }))
    });
    return comExpiracao(formatarProfissionaisTurma(await tx.turma.findUnique({ where: { id: turma.id }, include: { ano_letivo: true, horarios: true, profissionais: selectVinculosProfissionais } })));
}

async function obterOrigemNovaTurma(cliente, id) {
    const origem = await cliente.turma.findUnique({ where: { id }, include: {
        ano_letivo: true, horarios: true, ambiente: { select: { id: true, nome: true } },
        profissionais: selectVinculosProfissionais,
    } });
    if (!origem || origem.deleted_at) throw Object.assign(new Error('Turma de origem não encontrada.'), { statusCode: 404 });
    if (origem.tipo !== 'REGULAR' || origem.status !== 'INATIVO') {
        throw Object.assign(new Error('Selecione uma turma regular inativa para criar a nova turma.'), { statusCode: 409 });
    }
    return origem;
}

async function consultarCandidatosNovaTurma(cliente, turno, ids) {
    return cliente.aluno.findMany({
        where: { status: 'ATIVO', deleted_at: null, turno, ...(ids ? { id: { in: ids } } : {}),
            matriculas_turmas: { none: { ...filtroMatriculasAtivas(), turma: { tipo: 'REGULAR', status: 'ATIVO', deleted_at: null } } },
        },
        select: { id: true, participa_procan: true, pessoa: { select: { nome: true } } },
        orderBy: [{ pessoa: { nome: 'asc' } }, { id: 'asc' }],
    });
}

async function prepararNovaTurmaService(id, turno) {
    await sincronizarTurmasExpiradas();
    const origem = await obterOrigemNovaTurma(prisma, id);
    const alunos = await consultarCandidatosNovaTurma(prisma, turno ?? origem.turno);
    const anteriores = await prisma.matricula_turma.findMany({
        where: { turma_id: id, aluno_id: { in: alunos.map((a) => a.id) }, status: { in: ['ATIVO', 'INATIVO'] }, data_inicio: { not: null } },
        select: { aluno_id: true, data_inicio: true, data_fim: true },
    });
    const idsAnteriores = new Set(anteriores.filter((m) => !m.data_fim || m.data_fim >= m.data_inicio).map((m) => m.aluno_id));
    return { origem: comExpiracao(formatarProfissionaisTurma(origem)), alunos: alunos.map((a) => ({ id: a.id, nome: a.pessoa.nome, participa_procan: a.participa_procan, ano_anterior: idsAnteriores.has(a.id) })) };
}

async function criarTurmaAPartirService(id, entrada) {
    const { turma: dados, alunos_ids } = criarTurmaAPartirDTO.parse(entrada);
    await sincronizarTurmasExpiradas({ turmaIds: [id], alunoIds: alunos_ids });
    return prisma.$transaction(async (tx) => {
        await bloquearCalendarios(tx);
        // A seleção inteira é bloqueada antes das turmas, como nos fluxos de matrícula.
        const ids = [...alunos_ids].sort((a, b) => a - b);
        for (const alunoId of ids) await tx.$queryRaw`SELECT "id" FROM "aluno" WHERE "id" = ${alunoId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "turma" WHERE "id" = ${id} FOR UPDATE`;
        await obterOrigemNovaTurma(tx, id);
        const candidatos = await consultarCandidatosNovaTurma(tx, dados.turno, ids);
        const elegiveis = new Set(candidatos.map((a) => a.id));
        if (ids.some((alunoId) => !elegiveis.has(alunoId))) {
            throw Object.assign(new Error('Um ou mais alunos deixaram de estar disponíveis. Revise a seleção: devem estar ativos, no turno escolhido e sem turma regular ativa.'), { statusCode: 409 });
        }
        if (dados.capacidade_maxima != null && ids.length > dados.capacidade_maxima) {
            throw Object.assign(new Error('A quantidade de alunos selecionados excede o número de vagas.'), { statusCode: 409 });
        }
        const nova = await criarTurmaNaTransacao(tx, dados);
        const dataInicio = inicioMatriculaRegular(nova);
        for (const alunoId of ids) {
            await matricularTurmaRegularNaTransacao(tx, { aluno_id: alunoId, turma_id: nova.id }, { dataInicio });
        }
        return nova;
    }, { isolationLevel: 'ReadCommitted', timeout: 15000 });
}

async function obterTurmaService(turma_id, incluirAlunos = true) {
  await sincronizarTurmasExpiradas({ turmaIds: [turma_id] });
  const hoje = hojeInstituicao();
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
      profissionais: selectVinculosProfissionais,
      ano_letivo_id: true,
      ano_letivo: true,
      status: true,
      _count: { select: { matriculas: true } },
      horarios: {
        select: { id: true, dia_semana: true, hora_inicio: true, hora_fim: true },
        orderBy: [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }, { id: 'asc' }]
      },
      ...(incluirAlunos ? { matriculas: {
        where: { ...filtroMatriculasAtivas(hoje), aluno: { deleted_at: null } },
        orderBy: [{ aluno: { pessoa: { nome: 'asc' } } }, { aluno_id: 'asc' }, { id: 'asc' }],
        select: {
          aluno: {
            select: {
              id: true, dias_frequencia: true,
              pessoa: { select: { nome: true } }
            }
          }
        }
      } } : {})
    },
  });
  if (!turma) return null;
  const cancelamentos = incluirAlunos ? await prisma.matricula_turma.findMany({
    where: { turma_id, ...filtroMatriculasParaEncerrar }, select: { id: true, status: true, data_fim: true },
  }) : [];
  const { matriculas = [], _count, ...dados } = turma;
  const vigentes = cancelamentos.filter((m) => matriculaVigente(m, hoje));
  const quantidadeAtivas = incluirAlunos ? vigentes.filter((m) => m.status === 'ATIVO').length
    : await prisma.matricula_turma.count({ where: { turma_id, ...filtroMatriculasAtivas(hoje) } });
  return { ...comExpiracao(formatarProfissionaisTurma(dados, true)), possui_matriculas: (_count?.matriculas ?? matriculas.length) > 0, alunos: matriculas.map((matricula) => matricula.aluno),
    matriculas_ativas: quantidadeAtivas,
    ...(incluirAlunos ? { confirmacao_cancelamentos: { matriculas: vigentes.map((m) => m.id).sort((a, b) => a - b),
      matriculas_ativas: quantidadeAtivas } } : {}) };
}

async function listarAlunosTurmaService(turmaId, paginacao) {
    await sincronizarTurmasExpiradas({ turmaIds: [turmaId] });
    const hoje = hojeInstituicao();
    const turma = await prisma.turma.findUnique({ where: { id: turmaId, deleted_at: null }, select: { id: true } });
    if (!turma) throw Object.assign(new Error('Turma não encontrada.'), { statusCode: 404 });
    const pagina = await paginarIds('alunos_turma', paginacao, { turmaId, hoje });
    const matriculas = await prisma.matricula_turma.findMany({ where: { id: { in: pagina.ids }, turma_id: turmaId, ...filtroMatriculasAtivas(hoje) },
        select: { id: true, aluno: { select: { id: true, dias_frequencia: true, pessoa: { select: { nome: true } } } } } });
    const resultado = formatarPagina(matriculas, pagina);
    return { ...resultado, itens: resultado.itens.map((m) => m.aluno) };
}

async function obterDiarioTurmaService(id, mes) {
    const hoje = hojeInstituicao();
    const turma = await prisma.turma.findUnique({ where: { id, deleted_at: null }, select: {
        nome: true, tipo: true, status: true,
        ano_letivo: { select: { ano: true, data_inicio: true, data_fim: true } },
        matriculas: { where: { ...filtroMatriculasAtivas(hoje), aluno: { deleted_at: null } },
            orderBy: [{ aluno: { pessoa: { nome: 'asc' } } }, { aluno_id: 'asc' }],
            select: { aluno: { select: { id: true, dias_frequencia: true, pessoa: { select: { nome: true } } } } } },
    } });
    if (!turma) throw Object.assign(new Error('Turma não encontrada.'), { statusCode: 404 });
    if (turma.tipo !== 'REGULAR' || turma.status !== 'ATIVO') {
        throw Object.assign(new Error('O diário de classe está disponível somente para turmas regulares ativas.'), { statusCode: 409 });
    }
    const calendario = turma.ano_letivo;
    if (!calendario) throw Object.assign(new Error('A turma não possui calendário letivo cadastrado.'), { statusCode: 409 });
    const inicioMes = new Date(0); inicioMes.setUTCFullYear(calendario.ano, mes - 1, 1);
    if (calendario.ano < hoje.getUTCFullYear() || (calendario.ano === hoje.getUTCFullYear() && mes < hoje.getUTCMonth() + 1)) {
        throw Object.assign(new Error('Selecione o mês atual ou um mês futuro.'), { statusCode: 400 });
    }
    const fimMes = new Date(inicioMes); fimMes.setUTCMonth(mes, 0);
    const inicio = new Date(Math.max(+inicioMes, +calendario.data_inicio));
    const fim = new Date(Math.min(+fimMes, +calendario.data_fim));
    let possuiDiaUtil = false;
    for (const dia = new Date(inicio); dia <= fim; dia.setUTCDate(dia.getUTCDate() + 1)) {
        if (dia.getUTCDay() !== 0 && dia.getUTCDay() !== 6) { possuiDiaUtil = true; break; }
    }
    if (!possuiDiaUtil) throw Object.assign(new Error('O mês selecionado não possui dias úteis dentro do calendário letivo.'), { statusCode: 400 });
    const alunos = [...new Map(turma.matriculas.map(({ aluno }) => [aluno.id, {
        nome: aluno.pessoa.nome, dias_frequencia: [...aluno.dias_frequencia].sort((a, b) => a - b),
    }])).values()];
    return { nome: turma.nome, calendario, alunos };
}

async function editarTurmaService(id, entrada) {
    const dados = editarTurmaDTO.parse(entrada);
    await sincronizarTurmasExpiradas({ turmaIds: [id] });
    return prisma.$transaction(async (tx) => {
        await bloquearCalendarios(tx);
        let encerrar;
        if (dados.status === 'INATIVO') encerrar = await bloquearTurmaParaEncerramento(tx, id);
        else await tx.$queryRaw`SELECT "id" FROM "turma" WHERE "id" = ${id} FOR UPDATE`;
        const turma = await tx.turma.findUnique({ where: { id }, include: { ano_letivo: true, horarios: true, profissionais: selectVinculosProfissionais } });
        if (!turma || turma.deleted_at) throw Object.assign(new Error('Turma não encontrada.'), { statusCode: 404 });
        const matriculas = await tx.matricula_turma.groupBy({ by: ['status', 'data_fim'], where: { turma_id: id }, _count: { _all: true } });
        const possuiMatriculas = matriculas.some((grupo) => grupo._count._all > 0);
        const hoje = hojeInstituicao();
        const ocupacao = matriculas.filter((grupo) => grupo.status === 'ATIVO' && matriculaVigente(grupo, hoje)).reduce((total, grupo) => total + grupo._count._all, 0);
        const regular = turma.tipo === 'REGULAR';
        if (regular && ['hora_inicio', 'hora_fim', 'dias_semana'].some((campo) => dados[campo] !== undefined)) {
            throw Object.assign(new Error('O cronograma de turmas regulares é definido pelo turno.'), { statusCode: 400 });
        }
        if (!regular && dados.ano_letivo_id !== undefined) {
            throw Object.assign(new Error('O ano letivo só pode ser editado em turmas regulares.'), { statusCode: 400 });
        }
        const hora = (valor) => valor.toISOString().slice(11, 16);
        const diasAtuais = [...new Set(turma.horarios.map((h) => h.dia_semana))].sort((a, b) => a - b);
        const novosDias = dados.dias_semana ? [...new Set(dados.dias_semana)].sort((a, b) => a - b) : diasAtuais;
        const mudouTurno = dados.turno !== undefined && dados.turno !== turma.turno;
        const mudouAno = dados.ano_letivo_id !== undefined && dados.ano_letivo_id !== turma.ano_letivo_id;
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
        const atuais = turma.profissionais.filter((vinculo) => !vinculo.data_fim).map((vinculo) => vinculo.profissional_id);
        if (dados.profissionais_ids !== undefined || dados.status === 'ATIVO') {
            const selecionados = dados.profissionais_ids ?? atuais;
            const validar = dados.status === 'ATIVO' ? selecionados : selecionados.filter((id) => !atuais.includes(id));
            if (validar.length) await validarProfissionaisTurma(tx, validar);
            if (!selecionados.length) throw Object.assign(new Error('Selecione ao menos um professor ou auxiliar.'), { statusCode: 400 });
        }
        if (regular && dados.status === 'ATIVO') {
            const calendario = dados.ano_letivo_id === undefined ? turma.ano_letivo
                : await tx.ano_letivo.findUnique({ where: { id: dados.ano_letivo_id } });
            if (turmaExpirada({ ...turma, ano_letivo: calendario })) {
                throw Object.assign(new Error('Não é possível ativar uma turma com ano letivo encerrado.'), { statusCode: 409 });
            }
        }
        if (mudouAno) {
            const calendario = await tx.ano_letivo.findUnique({ where: { id: dados.ano_letivo_id } });
            inicioMatriculaRegular({ nome: turma.nome, ano_letivo: calendario });
        }
        const mudouCronograma = mudouTurno || mudouHorario || mudouDias;
        let horarios;
        if (mudouCronograma) {
            const completos = criarTurmaDTO.parse({ ...turma, profissionais_ids: atuais, ...dados,
                hora_inicio: dados.hora_inicio ?? (turma.horarios[0] ? hora(turma.horarios[0].hora_inicio) : undefined),
                hora_fim: dados.hora_fim ?? (turma.horarios[0] ? hora(turma.horarios[0].hora_fim) : undefined),
                dias_semana: novosDias,
            });
            horarios = gerarHorariosTurma(completos);
        }
        const campos = ['nome', 'turno', 'ano_letivo_id', 'ambiente_id', 'capacidade_maxima', 'descricao', 'status'];
        const data = Object.fromEntries(campos.filter((campo) => dados[campo] !== undefined).map((campo) => [campo, dados[campo]]));
        if (encerrar) await encerrarMatriculasTurma(tx, turma, encerrar);
        await tx.turma.update({ where: { id }, data });
        if (dados.profissionais_ids !== undefined) await atualizarProfissionaisTurma(tx, id, dados.profissionais_ids, turma.profissionais);
        if (horarios) {
            await tx.turma_horario.deleteMany({ where: { turma_id: id } });
            await tx.turma_horario.createMany({ data: horarios.map((h) => ({ ...h, turma_id: id })) });
        }
        return comExpiracao(formatarProfissionaisTurma(await tx.turma.findUnique({ where: { id }, include: { ano_letivo: true, horarios: true, ambiente: { select: { id: true, nome: true } },
            profissionais: selectVinculosProfissionais } })));
    }, { isolationLevel: 'ReadCommitted' });
}

async function excluirTurmaService(id, entrada = {}) {
    const dados = excluirTurmaDTO.parse(entrada);
    return prisma.$transaction(async (tx) => {
        await bloquearCalendarios(tx);
        const matriculas = await bloquearTurmaParaEncerramento(tx, id);
        const turma = await tx.turma.findUnique({ where: { id }, include: { ano_letivo: true, horarios: true } });
        if (!turma || turma.deleted_at) throw Object.assign(new Error('Turma não encontrada.'), { statusCode: 404 });
        validarConfirmacao(matriculas, dados.confirmar_cancelamentos, true);
        await encerrarMatriculasTurma(tx, turma, matriculas);
        await tx.turma.update({ where: { id }, data: { status: 'INATIVO', deleted_at: new Date() } });
    }, { isolationLevel: 'ReadCommitted' });
}

module.exports = { listarTurmasService, listarTurmasRegularesPorTurnoService, criarTurmaService, obterTurmaService, editarTurmaService, excluirTurmaService, prepararNovaTurmaService, criarTurmaAPartirService, listarAlunosTurmaService, obterDiarioTurmaService };
