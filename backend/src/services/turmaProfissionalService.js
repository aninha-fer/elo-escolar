const { hojeInstituicao, DIA_MS } = require('./calendarioLetivo');
const { bloquearProfissionalAtivo } = require('./profissionalService');

const selectVinculosProfissionais = {
    select: {
        id: true, profissional_id: true, data_inicio: true, data_fim: true,
        profissional: { select: { id: true, cargo: true, deleted_at: true,
            pessoa: { select: { nome: true, status_geral: true } } } },
    },
    orderBy: [{ profissional: { pessoa: { nome: 'asc' } } }, { profissional_id: 'asc' }, { id: 'asc' }],
};

function profissionaisDaTurma(vinculos = [], data) {
    return [...new Map(vinculos.filter((vinculo) => data
        ? (!vinculo.data_inicio || vinculo.data_inicio <= data) && (!vinculo.data_fim || vinculo.data_fim >= data)
        : !vinculo.data_fim).map(({ profissional }) => [profissional.id, profissional])).values()]
        .sort((a, b) => a.pessoa.nome.localeCompare(b.pessoa.nome, 'pt-BR') || a.id - b.id);
}

function formatarProfissionaisTurma(turma, incluirHistorico = false) {
    if (!turma) return turma;
    const { profissionais: vinculos = [], ...dados } = turma;
    const formatar = (profissional) => ({ id: profissional.id, cargo: profissional.cargo,
        pessoa: { nome: profissional.pessoa.nome },
        status_geral: profissional.pessoa.status_geral, excluido: Boolean(profissional.deleted_at) });
    return { ...dados, profissionais: profissionaisDaTurma(vinculos).map(formatar),
        ...(incluirHistorico ? { historico_profissionais: vinculos.map((vinculo) => ({
            id: vinculo.id, profissional: formatar(vinculo.profissional),
            data_inicio: vinculo.data_inicio, data_fim: vinculo.data_fim,
        })) } : {}) };
}

async function validarProfissionaisTurma(tx, ids) {
    if (!ids.length) throw Object.assign(new Error('Selecione ao menos um professor ou auxiliar.'), { statusCode: 400 });
    for (const id of [...new Set(ids)].sort((a, b) => a - b)) {
        const profissional = await bloquearProfissionalAtivo(tx, id);
        if (!['professor', 'auxiliar'].includes(profissional.cargo.trim().toLocaleLowerCase('pt-BR'))) {
            throw Object.assign(new Error('Selecione profissionais ativos com função Professor ou Auxiliar.'), { statusCode: 400 });
        }
    }
}

async function atualizarProfissionaisTurma(tx, turmaId, ids, vinculos = []) {
    const atuais = vinculos.filter((vinculo) => !vinculo.data_fim).map((vinculo) => vinculo.profissional_id);
    const removidos = atuais.filter((id) => !ids.includes(id));
    const adicionados = ids.filter((id) => !atuais.includes(id));
    const hoje = hojeInstituicao();
    if (removidos.length) await tx.turma_profissional.updateMany({
        where: { turma_id: turmaId, profissional_id: { in: removidos }, data_fim: null },
        data: { data_fim: new Date(hoje.getTime() - DIA_MS) },
    });
    if (adicionados.length) await tx.turma_profissional.createMany({
        data: adicionados.map((profissional_id) => ({ turma_id: turmaId, profissional_id, data_inicio: hoje })),
    });
}

module.exports = { selectVinculosProfissionais, profissionaisDaTurma, formatarProfissionaisTurma,
    validarProfissionaisTurma, atualizarProfissionaisTurma };
