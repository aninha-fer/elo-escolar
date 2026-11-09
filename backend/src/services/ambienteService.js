const prisma = require('../prismaClient');

async function listarAmbientesService() {
    return prisma.ambiente.findMany({
        select: { id: true, nome: true },
        orderBy: [{ nome: 'asc' }, { id: 'asc' }]
    });
}

module.exports = { listarAmbientesService };
