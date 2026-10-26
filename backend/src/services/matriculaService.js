const prisma = require('../prismaClient');

const DIA_MS = 86400000;

function obterDataInicioMatricula() {
    const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
    return new Date(`${valor('year')}-${valor('month')}-${valor('day')}T00:00:00.000Z`);
}

function obterInicio(data, hora) {
    return data.getTime() + hora.getUTCHours() * 3600000 +
        hora.getUTCMinutes() * 60000 + hora.getUTCSeconds() * 1000;
}

async function obterConflitosAtendimentos(tx, aluno_id, oficinas, dataInicio) {
    const sessoes = await tx.atendimento_sessao.findMany({
        where: { status: 'ATIVO', atendimento_clinico: { aluno_id, status: 'ATIVO' } },
        select: {
            id: true, atendimento_clinico_id: true, data_sessao: true,
            hora_inicio: true, duracao_minutos: true,
            atendimento_clinico: { select: { modalidade: true } }
        }
    });
    const conflitos = [];
    for (const sessao of sessoes) {
        const inicioSessao = obterInicio(sessao.data_sessao, sessao.hora_inicio);
        const fimSessao = inicioSessao + sessao.duracao_minutos * 60000;
        if (fimSessao <= dataInicio.getTime()) continue;

        for (const oficina of oficinas) {
            for (const horario of oficina.horarios) {
                // Inclui o dia anterior para oficinas noturnas, respeitando o início do vínculo.
                const primeiroDia = Math.max(sessao.data_sessao.getTime() - DIA_MS, dataInicio.getTime());
                const dia = new Date(primeiroDia);
                dia.setUTCDate(dia.getUTCDate() + (horario.dia_semana - (dia.getUTCDay() || 7) + 7) % 7);

                for (; dia.getTime() < fimSessao; dia.setUTCDate(dia.getUTCDate() + 7)) {
                    const inicioOficina = obterInicio(dia, horario.hora_inicio);
                    let fimOficina = obterInicio(dia, horario.hora_fim);
                    if (fimOficina < inicioOficina) fimOficina += DIA_MS;
                    if (inicioOficina < fimSessao && fimOficina > inicioSessao) {
                        conflitos.push({
                            codigo: 'CHOQUE_HORARIO_ATENDIMENTO',
                            oficina_nome: oficina.nome,
                            detalhes: {
                                oficina_id: oficina.id,
                                data_oficina: dia.toISOString().slice(0, 10),
                                hora_inicio_oficina: new Date(inicioOficina).toISOString().slice(11, 16),
                                hora_fim_oficina: new Date(fimOficina).toISOString().slice(11, 16),
                                sessao_id: sessao.id,
                                atendimento_id: sessao.atendimento_clinico_id,
                                modalidade: sessao.atendimento_clinico.modalidade,
                                data_sessao: sessao.data_sessao.toISOString().slice(0, 10),
                                hora_inicio: sessao.hora_inicio.toISOString().slice(11, 16),
                                data_fim: new Date(fimSessao).toISOString().slice(0, 10),
                                hora_fim: new Date(fimSessao).toISOString().slice(11, 16)
                            }
                        });
                    }
                }
            }
        }
    }
    return conflitos;
}

async function matricularOficinasService({ aluno_id, oficinas_ids }) {
    return prisma.$transaction(async (tx) => {
        // Compartilha o bloqueio usado na criação de atendimentos para o mesmo aluno.
        await tx.$queryRaw`SELECT "id" FROM "aluno" WHERE "id" = ${aluno_id} FOR UPDATE`;
        return matricularOficinasNaTransacao(tx, { aluno_id, oficinas_ids });
    }, { isolationLevel: 'ReadCommitted' });
}

async function matricularOficinasNaTransacao(tx, { aluno_id, oficinas_ids }) {
    const conflitos = [];

    const aluno = await tx.aluno.findUnique({
        where: { id: aluno_id }
    });

    if (!aluno || aluno.status !== 'ATIVO') {
        throw new Error('Aluno não encontrado ou inativo.');
    }

    const dataInicio = obterDataInicioMatricula();
    const oficinas = await tx.turma.findMany({
        where: {
            id: { in: oficinas_ids },
            tipo: 'OFICINA',
            status: 'ATIVO'
        },
        include: { horarios: true }
    });

    if (oficinas.length !== oficinas_ids.length) {
        conflitos.push("Uma ou mais oficinas selecionadas são inválidas, não existem ou estão inativas.");
    }


    const vagasOcupadas = await tx.matricula_turma.groupBy({
        by: ['turma_id'],
        where: {
            turma_id: { in: oficinas_ids },
            status: 'ATIVO'
        },
        _count: { turma_id: true }
    });

    const contagemVagas = vagasOcupadas.reduce((acc, curr) => {
        acc[curr.turma_id] = curr._count.turma_id;
        return acc;
    }, {});

    for (const oficina of oficinas) {
        if (oficina.turno !== aluno.turno) {
            conflitos.push({
                codigo: 'TURNO_INCOMPATIVEL',
                oficina_nome: oficina.nome,
                detalhes: {
                    turno_oficina: oficina.turno,
                    turno_aluno: aluno.turno,
                },
            });
        }

        const diasOficina = [...new Set(oficina.horarios.map(h => h.dia_semana))];
        const diasNaoAutorizados = diasOficina.filter(dia => !aluno.dias_frequencia.includes(dia));
        if (diasNaoAutorizados.length > 0) {
            conflitos.push({
                codigo: 'FREQUENCIA_INSUFICIENTE',
                oficina_nome: oficina.nome,
                detalhes: {
                    dias_exigidos: diasNaoAutorizados.join(', '),
                },
            });
        }

        const ocupacaoAtual = contagemVagas[oficina.id] || 0;
        if (ocupacaoAtual >= oficina.capacidade_maxima) {
            conflitos.push({
                codigo: 'CAPACIDADE_MAXIMA',
                oficina_nome: oficina.nome,
                detalhes: {
                    capacidade: oficina.capacidade_maxima,
                },
            });
        }
    }

    // --- Início: Validação de Choque de Horários ---
    const matriculasAtuais = await tx.matricula_turma.findMany({
        where: {
            aluno_id: aluno.id,
            status: 'ATIVO'
        },
        include: {
            turma: {
                include: { horarios: true }
            }
        }
    });

    const turmasMatriculadasIds = matriculasAtuais.map(m => m.turma_id);
    for (const oficina of oficinas) {
        if (turmasMatriculadasIds.includes(oficina.id)) {
            conflitos.push({
                codigo: 'MATRICULA_DUPLICADA',
                oficina_nome: oficina.nome,
            });
        }
    }

    const gradeAtual = [];
    for (const m of matriculasAtuais) {
        for (const h of m.turma.horarios) {
            gradeAtual.push({
                turma_nome: m.turma.nome,
                turma_tipo: m.turma.tipo,
                dia_semana: h.dia_semana,
                hora_inicio: h.hora_inicio.getTime(),
                hora_fim: h.hora_fim.getTime()
            });
        }
    }

    const gradeSolicitada = [];
    for (const oficina of oficinas) {
        if (turmasMatriculadasIds.includes(oficina.id)) {
            continue;
        }

        for (const h of oficina.horarios) {
            gradeSolicitada.push({
                turma_nome: oficina.nome,
                dia_semana: h.dia_semana,
                hora_inicio: h.hora_inicio.getTime(),
                hora_fim: h.hora_fim.getTime()
            });
        }
    }

    const temChoqueHorario = (h1, h2) => {
        return (h1.dia_semana === h2.dia_semana) &&
            (h1.hora_inicio < h2.hora_fim) &&
            (h1.hora_fim > h2.hora_inicio);
    };

    for (let i = 0; i < gradeSolicitada.length; i++) {
        for (let j = i + 1; j < gradeSolicitada.length; j++) {
            const req1 = gradeSolicitada[i];
            const req2 = gradeSolicitada[j];

            if (temChoqueHorario(req1, req2)) {
                conflitos.push({
                    codigo: 'OFICINAS_SIMULTANEAS',
                    detalhes: {
                        oficina_1: req1.turma_nome,
                        oficina_2: req2.turma_nome,
                        dia_semana: req1.dia_semana,
                    },
                });
            }
        }
    }

    for (const req of gradeSolicitada) {
        for (const atual of gradeAtual) {
            if (atual.turma_tipo === 'REGULAR') {
                continue;
            }

            if (temChoqueHorario(req, atual)) {
                conflitos.push({
                codigo: 'CHOQUE_HORARIO_OFICINA',
                oficina_nome: req.turma_nome,
                detalhes: {
                    oficina_matriculada: atual.turma_nome,
                    dia_semana: req.dia_semana,
                },
            });
            }
        }
    }

    // --- Fim: Validação de Choque de Horários ---

    conflitos.push(...await obterConflitosAtendimentos(tx, aluno.id, oficinas, dataInicio));

    if (conflitos.length > 0) {
        const erroConflito = new Error('Conflitos de agenda identificados.');
        erroConflito.isConflict = true;
        erroConflito.detalhes = conflitos;
        throw erroConflito;
    }

    const novasMatriculas = [];
    for (const oficina of oficinas) {
        novasMatriculas.push(await tx.matricula_turma.create({
            data: {
                aluno_id: aluno.id,
                turma_id: oficina.id,
                data_inicio: dataInicio,
                status: 'ATIVO'
            }
        }));
    }

    return {
        mensagem: "Agenda gerada com sucesso.",
        matriculas: novasMatriculas
    };
}

async function cancelarOficinaService({ aluno_id, matricula_id }) {
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "aluno" WHERE "id" = ${aluno_id} FOR UPDATE`;
        const select = {
            id: true, aluno_id: true, turma_id: true, status: true, data_inicio: true, data_fim: true
        };
        const matricula = await tx.matricula_turma.findFirst({
            where: { id: matricula_id, aluno_id, turma: { tipo: 'OFICINA' } },
            select
        });
        if (!matricula) {
            const erro = new Error('Inscrição em oficina não encontrada para este aluno.');
            erro.statusCode = 404;
            throw erro;
        }
        if (matricula.status === 'INATIVO') {
            return { mensagem: 'A inscrição já está cancelada.', matricula };
        }

        const ontem = new Date(obterDataInicioMatricula().getTime() - DIA_MS);
        // Um cancelamento não pode estender um período que já tinha término anterior.
        const dataFim = matricula.data_fim && matricula.data_fim < ontem ? matricula.data_fim : ontem;
        const encerrada = await tx.matricula_turma.update({
            where: { id: matricula.id },
            data: { status: 'INATIVO', data_fim: dataFim },
            select
        });
        return { mensagem: 'Inscrição cancelada a partir de hoje. O histórico anterior foi preservado.', matricula: encerrada };
    }, { isolationLevel: 'ReadCommitted' });
}

module.exports = { matricularOficinasService, cancelarOficinaService };
