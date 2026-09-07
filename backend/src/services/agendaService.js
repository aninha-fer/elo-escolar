const prisma = require('../prismaClient');

async function obterAgendaAlunoService(aluno_id) {
    const aluno = await prisma.aluno.findUnique({
        where: { id: aluno_id }
    });

    if (!aluno) {
        const erro = new Error('Aluno não encontrado.');
        erro.status = 404;
        throw erro;
    }

    const matriculas = await prisma.matricula_turma.findMany({
        where: {
            aluno_id,
            status: 'ATIVO'
        },
        include: {
        turma: {
            include: {
            horarios: true,
            ambiente: true,
            profissional: {
                include: { pessoa: true }
            }
            }
        }
        }
    });

    const agenda = [];

    for (const m of matriculas) {
        for (const h of m.turma.horarios) {
        agenda.push({
            matricula_id: m.id,
            turma_id: m.turma.id,
            turma_nome: m.turma.nome,
            tipo: m.turma.tipo,
            dia_semana: h.dia_semana,
            hora_inicio: h.hora_inicio.toISOString().substring(11, 16), 
            hora_fim: h.hora_fim.toISOString().substring(11, 16),
            ambiente: m.turma.ambiente?.nome || 'Não definido',
            profissional: m.turma.profissional?.pessoa?.nome || 'Não definido'
        });
        }
    }

    agenda.sort((a, b) => {
        if (a.dia_semana !== b.dia_semana) {
        return a.dia_semana - b.dia_semana;
        }
        return a.hora_inicio.localeCompare(b.hora_inicio);
    });

    return agenda;
}

module.exports = { obterAgendaAlunoService };