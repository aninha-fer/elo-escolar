const prisma = require('../prismaClient');

async function listarTurmasService(tipo) {
    const filtro = tipo ? { tipo } : {};
    const turmas = await prisma.turma.findMany({
        where: filtro,
        include: {
            ambiente: true,
            profissional: {
                include: { pessoa: true }
            },
        },
        orderBy: {
            nome: 'asc'
        }
  });
  return turmas;
}

module.exports = { listarTurmasService };