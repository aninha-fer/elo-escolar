const prisma = require('../prismaClient');
const { paginarIds, formatarPagina } = require('./paginacaoService');
const { agoraInstituicao, inicioOcorrencia } = require('./encerramentoAtividade');

async function bloquearProfissionalAtivo(tx, id) {
    await tx.$queryRaw`SELECT "id" FROM "funcionario" WHERE "id" = ${id} FOR UPDATE`;
    const profissional = await tx.funcionario.findUnique({ where: { id },
        select: { id: true, cargo: true, deleted_at: true, pessoa: { select: { status_geral: true } } } });
    if (!profissional || profissional.deleted_at) throw Object.assign(new Error('Profissional não encontrado.'), { statusCode: 404 });
    if (profissional.pessoa.status_geral !== 'ATIVO') throw Object.assign(new Error('Selecione um profissional ativo.'), { statusCode: 400 });
    return profissional;
}

async function validarEncerramentoProfissional(tx, id, acao) {
    const agora = agoraInstituicao();
    const [turmas, sessoes] = await Promise.all([
        tx.turma.findMany({ where: { profissional_id: id, status: 'ATIVO' }, select: { id: true, nome: true } }),
        tx.atendimento_sessao.findMany({ where: {
            status: 'ATIVO', data_cancelamento: null,
            atendimento_clinico: { status: 'ATIVO', data_cancelamento: null },
            OR: [{ profissional_id: id }, { atendimento_clinico: { profissional_id: id } }],
        }, include: { atendimento_clinico: { select: { id: true, modalidade_cadastrada: { select: { nome: true } } } } } }),
    ]);
    const vigentes = sessoes.filter((s) => inicioOcorrencia(s.data_sessao, s.hora_inicio) + s.duracao_minutos * 60000 > agora.getTime());
    const atendimentos = [...new Map(vigentes.map((s) => [s.atendimento_clinico.id, s.atendimento_clinico])).values()];
    if (turmas.length || atendimentos.length) {
        throw Object.assign(new Error(`Não é possível ${acao} um profissional responsável por turmas ativas ou atendimentos ativos ainda não concluídos.`), {
            isConflict: true,
            detalhes: [
                ...turmas.map((turma) => ({ codigo: 'TURMA_VINCULADA', turma_id: turma.id, mensagem: `Responsável pela turma ${turma.nome}.` })),
                ...atendimentos.map((a) => ({ codigo: 'ATENDIMENTO_VINCULADO', atendimento_id: a.id, mensagem: `Responsável pelo atendimento ${a.modalidade_cadastrada.nome} (código ${a.id}).` })),
            ],
        });
    }
    return agora;
}

async function cancelarPlanejamentoProfissional(tx, id, agora) {
    const atendimentos = await tx.atendimento_clinico.findMany({ where: {
        status: 'PROVISORIO', data_cancelamento: null,
        OR: [{ profissional_id: id }, { sessoes: { some: { profissional_id: id, status: 'PROVISORIO', data_cancelamento: null } } }],
    }, include: { sessoes: true } });
    const relacionados = atendimentos.filter((a) => a.profissional_id === id || a.sessoes.some((s) =>
        s.profissional_id === id && s.status === 'PROVISORIO' && !s.data_cancelamento && inicioOcorrencia(s.data_sessao, s.hora_inicio) > agora.getTime()));
    const hoje = new Date(agora); hoje.setUTCHours(0, 0, 0, 0);
    const futuras = relacionados.flatMap((a) => a.sessoes.filter((s) => s.status === 'PROVISORIO' && !s.data_cancelamento
        && inicioOcorrencia(s.data_sessao, s.hora_inicio) > agora.getTime()).map((s) => s.id));
    if (relacionados.length) await tx.atendimento_clinico.updateMany({
        where: { id: { in: relacionados.map((a) => a.id) }, status: 'PROVISORIO', data_cancelamento: null }, data: { data_cancelamento: hoje },
    });
    if (futuras.length) await tx.atendimento_sessao.updateMany({
        where: { id: { in: futuras }, status: 'PROVISORIO', data_cancelamento: null }, data: { data_cancelamento: hoje },
    });
}

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

async function listarProfissionaisService(paginacao) {
    const pagina = paginacao ? await paginarIds('profissionais', paginacao) : null;
    const profissionais = await prisma.funcionario.findMany({
        where: { deleted_at: null, ...(pagina ? { id: { in: pagina.ids } } : {}) },
        select: {
            id: true,
            pessoa_id: true,
            cargo: true,
            pessoa: { select: { nome: true, telefone: true, status_geral: true } },
        },
        orderBy: [{ pessoa: { nome: 'asc' } }, { id: 'asc' }],
    });

    const itens = profissionais.map(profissional => {
        return {
            id: profissional.id,
            pessoa_id: profissional.pessoa_id,
            nome: profissional.pessoa.nome,
            telefone: profissional.pessoa.telefone,
            funcao: profissional.cargo,
            status_geral: profissional.pessoa.status_geral
        };
    });
    return formatarPagina(itens, pagina);
}

async function editarProfissionalService(id, dados) {
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "funcionario" WHERE "id" = ${id} FOR UPDATE`;
        const profissional = await tx.funcionario.findUnique({
            where: { id },
            select: { id: true, pessoa_id: true, deleted_at: true, pessoa: { select: { status_geral: true } } }
        });
        if (!profissional || profissional.deleted_at) {
            throw Object.assign(new Error('Profissional não encontrado.'), { statusCode: 404 });
        }
        if (profissional.pessoa.status_geral === 'INATIVO' &&
            (dados.status_geral !== 'ATIVO' || Object.keys(dados).some((campo) => campo !== 'status_geral' && dados[campo] !== undefined))) {
            throw Object.assign(new Error('Ative o profissional antes de editar seus dados.'), { statusCode: 409 });
        }
        if (dados.status_geral === 'INATIVO') {
            const agora = await validarEncerramentoProfissional(tx, id, 'inativar');
            await cancelarPlanejamentoProfissional(tx, id, agora);
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
            await tx.usuario.updateMany({ where: { pessoa_id: profissional.pessoa_id, deleted_at: null }, data: { status: dados.status_geral } });
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

async function excluirProfissionalService(id) {
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "funcionario" WHERE "id" = ${id} FOR UPDATE`;
        const profissional = await tx.funcionario.findUnique({ where: { id }, select: { id: true, pessoa_id: true, deleted_at: true } });
        if (!profissional || profissional.deleted_at) throw Object.assign(new Error('Profissional não encontrado.'), { statusCode: 404 });
        const agora = await validarEncerramentoProfissional(tx, id, 'excluir');
        await cancelarPlanejamentoProfissional(tx, id, agora);
        const deleted_at = new Date();
        await tx.pessoa.update({ where: { id: profissional.pessoa_id }, data: { telefone: null, data_nascimento: null, status_geral: 'INATIVO' } });
        await tx.usuario.updateMany({ where: { pessoa_id: profissional.pessoa_id, deleted_at: null }, data: { deleted_at, email: null, senha_hash: null, status: 'INATIVO' } });
        await tx.funcionario.update({ where: { id }, data: { deleted_at } });
    }, { isolationLevel: 'ReadCommitted' });
}

module.exports = {
    criarProfissionalService,
    listarProfissionaisService,
    editarProfissionalService,
    excluirProfissionalService,
    bloquearProfissionalAtivo,
};
