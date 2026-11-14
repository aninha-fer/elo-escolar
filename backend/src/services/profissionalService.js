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
            pessoa_id: true,
            cargo: true,
            pessoa: { select: { nome: true, telefone: true, status_geral: true } },
        },
        orderBy: [{ pessoa: { nome: 'asc' } }, { id: 'asc' }],
    });

    return profissionais.map(profissional => {
        return {
            id: profissional.id,
            pessoa_id: profissional.pessoa_id,
            nome: profissional.pessoa.nome,
            telefone: profissional.pessoa.telefone,
            funcao: profissional.cargo,
            status_geral: profissional.pessoa.status_geral
        };
    });
}

async function editarProfissionalService(id, dados) {
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "funcionario" WHERE "id" = ${id} FOR UPDATE`;
        const profissional = await tx.funcionario.findUnique({
            where: { id },
            select: { id: true, pessoa_id: true, pessoa: { select: { status_geral: true } } }
        });
        if (!profissional) {
            throw Object.assign(new Error('Profissional não encontrado.'), { statusCode: 404 });
        }
        if (profissional.pessoa.status_geral === 'INATIVO' &&
            (dados.status_geral !== 'ATIVO' || Object.keys(dados).some((campo) => campo !== 'status_geral' && dados[campo] !== undefined))) {
            throw Object.assign(new Error('Ative o profissional antes de editar seus dados.'), { statusCode: 409 });
        }
        if (dados.status_geral === 'INATIVO') {
            const [turmas, atendimentos] = await Promise.all([
                tx.turma.findMany({ where: { profissional_id: id }, select: { id: true, nome: true } }),
                tx.atendimento_clinico.findMany({ where: { profissional_id: id }, select: { id: true, modalidade: true } }),
            ]);
            if (turmas.length || atendimentos.length) {
                const erro = new Error('Não é possível inativar um profissional responsável por turmas ou atendimentos.');
                erro.isConflict = true;
                erro.detalhes = [
                    ...turmas.map((turma) => ({ codigo: 'TURMA_VINCULADA', turma_id: turma.id, mensagem: `Responsável pela turma ${turma.nome}.` })),
                    ...atendimentos.map((atendimento) => ({ codigo: 'ATENDIMENTO_VINCULADO', atendimento_id: atendimento.id, mensagem: `Responsável pelo atendimento ${atendimento.modalidade} (código ${atendimento.id}).` })),
                ];
                throw erro;
            }
        }
        const dadosPessoa = {
            ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
            ...(dados.telefone !== undefined ? { telefone: dados.telefone } : {}),
            ...(dados.status_geral !== undefined ? { status_geral: dados.status_geral } : {}),
        };
        if (Object.keys(dadosPessoa).length) {
            await tx.pessoa.update({ where: { id: profissional.pessoa_id }, data: dadosPessoa });
        }
        if (dados.cargo !== undefined) {
            await tx.funcionario.update({ where: { id }, data: { cargo: dados.cargo } });
        }
        if (dados.status_geral !== undefined) {
            await tx.usuario.updateMany({ where: { pessoa_id: profissional.pessoa_id }, data: { status: dados.status_geral } });
        }
        const atualizado = await tx.funcionario.findUnique({
            where: { id },
            select: { id: true, pessoa_id: true, cargo: true, pessoa: { select: { nome: true, telefone: true, status_geral: true } } }
        });
        return {
            id: atualizado.id, pessoa_id: atualizado.pessoa_id, nome: atualizado.pessoa.nome,
            telefone: atualizado.pessoa.telefone, funcao: atualizado.cargo, status_geral: atualizado.pessoa.status_geral,
        };
    }, { isolationLevel: 'ReadCommitted' });
}

module.exports = {
    criarProfissionalService,
    listarProfissionaisService,
    editarProfissionalService,
};
