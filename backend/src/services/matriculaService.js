const prisma = require('../prismaClient');

async function matricularOficinasService({ aluno_id, oficinas_ids }) {
    const conflitos = [];

    const aluno = await prisma.aluno.findUnique({
        where: { id: aluno_id }
    });

    if (!aluno || aluno.status !== 'ATIVO') {
        throw new Error('Aluno não encontrado ou inativo.');
    }

    const oficinas = await prisma.turma.findMany({
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


    const vagasOcupadas = await prisma.matricula_turma.groupBy({
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
            conflitos.push(`[${oficina.nome}] Ocorre no turno ${oficina.turno}, incompatível com o turno ${aluno.turno} do aluno.`);
        }

        const diasOficina = [...new Set(oficina.horarios.map(h => h.dia_semana))];
        const diasNaoAutorizados = diasOficina.filter(dia => !aluno.dias_frequencia.includes(dia));
        if (diasNaoAutorizados.length > 0) {
            conflitos.push(`[${oficina.nome}] Ocorre em dias que o aluno não tem frequência registrada (Dias exigidos: ${diasNaoAutorizados.join(', ')}).`);
        }

        const ocupacaoAtual = contagemVagas[oficina.id] || 0;
        if (ocupacaoAtual >= oficina.capacidade_maxima) {
            conflitos.push(`[${oficina.nome}] Não possui vagas disponíveis (Capacidade: ${oficina.capacidade_maxima}).`);
        }
    }

    // --- Início: Validação de Choque de Horários ---
    const matriculasAtuais = await prisma.matricula_turma.findMany({
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
            conflitos.push(`Matrícula duplicada: O aluno já está matriculado na oficina [${oficina.nome}].`);
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
                conflitos.push(`Choque interno: [${req1.turma_nome}] e [${req2.turma_nome}] ocorrem simultaneamente no dia da semana ${req1.dia_semana}.`);
            }
        }
    }

    for (const req of gradeSolicitada) {
        for (const atual of gradeAtual) {
            if (atual.turma_tipo === 'REGULAR') {
                continue; 
            }

            if (temChoqueHorario(req, atual)) {
                conflitos.push(`Choque de horário: A oficina [${req.turma_nome}] sobrepõe a atividade já matriculada [${atual.turma_nome}] no dia da semana ${req.dia_semana}.`);
            }
        }
    }

    // --- Fim: Validação de Choque de Horários ---

    if (conflitos.length > 0) {
        const erroConflito = new Error('Conflitos de agenda identificados.');
        erroConflito.isConflict = true;
        erroConflito.detalhes = conflitos;
        throw erroConflito;
    }

    const novasMatriculas = await prisma.$transaction(
        oficinas.map(oficina => 
        prisma.matricula_turma.create({
            data: {
                aluno_id: aluno.id,
                turma_id: oficina.id,
                data_inicio: new Date(),
                status: 'ATIVO'
            }
        })
        )
    );

    return {
        mensagem: "Agenda gerada com sucesso.",
        matriculas: novasMatriculas
    };
}

module.exports = { matricularOficinasService };