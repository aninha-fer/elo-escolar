const prisma = require('../prismaClient');

async function criarProfissionalService(dadosProfissional) {
    const { nome, telefone, email, cargo } = dadosProfissional;

    if (typeof nome !== 'string' || nome.trim() === '') {
        throw Object.assign(new Error('Informe o nome do profissional.'), { statusCode: 400 });
    }

    if (typeof cargo !== 'string' || cargo.trim() === '') {
        throw Object.assign(new Error('O cargo é obrigatório.'), { statusCode: 400 });
    }

    if (email != null && (typeof email !== 'string' || email.trim() !== '')) {
        throw Object.assign(new Error('O cadastro de e-mail do profissional ainda não está disponível.'), { statusCode: 400 });
    }

    const novoProfissional = await prisma.$transaction(async (tx) => {
        const pessoa = await tx.pessoa.create({
            data: {
                nome: nome.trim(),
                telefone: telefone || null,
                status_geral: 'ATIVO',
            }
        });

        const profissional = await tx.funcionario.create({
            data: {
                pessoa_id: pessoa.id,
                cargo: cargo.trim()
            }
        });

        return {
            id: profissional.id,
            pessoa_id: pessoa.id,
            nome: pessoa.nome,
            telefone: pessoa.telefone,
            cargo: profissional.cargo,
            status_geral: pessoa.status_geral,
        };
    }, { isolationLevel: 'ReadCommitted' });

    return novoProfissional;
}

async function listarProfissionaisService() {
    const profissionais = await prisma.funcionario.findMany({
        select: {
            id: true,
            cargo: true,
            pessoa: { select: { nome: true, telefone: true, status_geral: true } },
        },
        orderBy: [{ pessoa: { nome: 'asc' } }, { id: 'asc' }],
    });

    return profissionais.map(profissional => {
        return {
            id: profissional.id,
            nome: profissional.pessoa.nome,
            telefone: profissional.pessoa.telefone,
            funcao: profissional.cargo,
            status_geral: profissional.pessoa.status_geral
        };
    });
}

module.exports = {
    criarProfissionalService,
    listarProfissionaisService
};
