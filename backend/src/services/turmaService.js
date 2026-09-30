const prisma = require('../prismaClient');

async function listarTurmasService(tipo) {
    const filtro = tipo ? { tipo } : {};
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
        vagas_disponiveis: Math.max(turma.capacidade_maxima - turma._count.matriculas, 0),
        _count: undefined,
    }));
}

module.exports = { listarTurmasService };