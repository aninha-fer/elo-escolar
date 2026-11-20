const prisma = require('../prismaClient');
const { paginarIds, formatarPagina } = require('./paginacaoService');

async function listarModalidadesService(paginacao) {
    const pagina = paginacao ? await paginarIds('modalidades', paginacao) : null;
    const itens = await prisma.modalidade.findMany({
        where: pagina ? { id: { in: pagina.ids } } : {},
        select: { id: true, nome: true }, orderBy: [{ nome: 'asc' }, { id: 'asc' }],
    });
    return formatarPagina(itens, pagina);
}

async function criarModalidadeService({ nome }) {
    try {
        return await prisma.modalidade.create({ data: { nome }, select: { id: true, nome: true } });
    } catch (erro) {
        if (erro.code === 'P2002') throw Object.assign(new Error('Já existe uma modalidade com esse nome.'), { statusCode: 409 });
        throw erro;
    }
}

async function validarModalidade(tx, id) {
    const modalidade = await tx.modalidade.findUnique({ where: { id }, select: { id: true, nome: true } });
    if (!modalidade) throw Object.assign(new Error('Modalidade não encontrada. Selecione uma modalidade cadastrada.'), { statusCode: 404 });
    return modalidade;
}

function comNomeModalidade({ modalidade_cadastrada, ...atendimento }) {
    return { ...atendimento, modalidade: modalidade_cadastrada.nome };
}

module.exports = { listarModalidadesService, criarModalidadeService, validarModalidade, comNomeModalidade };
