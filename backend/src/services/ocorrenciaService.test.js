const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const controller = require('../controllers/ocorrenciaController');
const { exigirPermissao } = require('../middlewares/exigirPermissao');

const params = { aluno_id: '10', ocorrencia_id: '20' };
const dados = { resumo: ' Queda no corredor ', descricao: ' Aluno acompanhado pela equipe. ', data: '2026-11-15', hora: '23:59' };
function resposta() {
    return { statusCode: null, body: null,
        status(codigo) { this.statusCode = codigo; return this; },
        json(body) { this.body = body; return this; },
        send() { return this; } };
}
function simular(t) {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-16T01:30:00Z') });
    simularMetodo(t, prisma.aluno, 'findUnique', async () => ({ id: 10 }));
}

function simularMetodo(t, objeto, campo, implementacao) {
    const original = objeto[campo];
    const mock = t.mock.fn(implementacao);
    objeto[campo] = mock;
    t.after(() => { objeto[campo] = original; });
    return mock;
}

test('criação aceita horário posterior de hoje em Brasília e obtém relator da sessão', async (t) => {
    simular(t);
    simularMetodo(t, prisma.ocorrencia_aluno, 'create', async ({ data, select }) => {
        assert.deepEqual(data, { aluno_id: 10, usuario_relator_id: 7, resumo: dados.resumo.trim(),
            descricao: dados.descricao.trim(), ocorrido_em: new Date('2026-11-16T02:59:00Z') });
        assert.equal(data.created_at, undefined);
        assert.deepEqual(Object.keys(select.usuario_relator.select), ['id', 'pessoa']);
        return { id: 20, ...data };
    });
    const res = resposta();
    await controller.criarOcorrencia({ params, body: dados, usuario: { id: 7 } }, res);
    assert.equal(res.statusCode, 201);
});

test('rejeita amanhã mesmo quando o relógio UTC já está no dia seguinte', async (t) => {
    simular(t);
    simularMetodo(t, prisma.ocorrencia_aluno, 'create', () => assert.fail('Não pode gravar data futura.'));
    const res = resposta();
    await controller.criarOcorrencia({ params, body: { ...dados, data: '2026-11-16' }, usuario: { id: 7 } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.erro, /futura/);
});

test('valida obrigatoriedade, datas reais, horários, limite do resumo e rejeita campos internos', async () => {
    for (const body of [{}, { ...dados, resumo: ' ' }, { ...dados, descricao: ' ' },
        { ...dados, resumo: 'a'.repeat(201) }, { ...dados, data: '2026-02-30' },
        { ...dados, hora: '24:00' }, { ...dados, created_at: '2026-01-01' }, { ...dados, usuario_relator_id: 8 }]) {
        const res = resposta();
        await controller.criarOcorrencia({ params, body, usuario: { id: 7 } }, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.erros.length);
    }
});

test('aceita data passada e respeita horário de verão histórico de Brasília', async (t) => {
    simular(t);
    simularMetodo(t, prisma.ocorrencia_aluno, 'create', async ({ data }) => {
        assert.equal(data.ocorrido_em.toISOString(), '2018-12-10T12:00:00.000Z');
        return data;
    });
    const res = resposta();
    await controller.criarOcorrencia({ params, body: { ...dados, data: '2018-12-10', hora: '10:00' }, usuario: { id: 7 } }, res);
    assert.equal(res.statusCode, 201);
});

test('PATCH de hora mantém a data local e não altera relator ou created_at', async (t) => {
    simular(t);
    simularMetodo(t, prisma.ocorrencia_aluno, 'findUnique', async ({ where }) => {
        assert.deepEqual(where, { id: 20, aluno_id: 10 });
        return { ocorrido_em: new Date('2026-11-15T01:00:00Z') };
    });
    simularMetodo(t, prisma.ocorrencia_aluno, 'update', async ({ where, data }) => {
        assert.deepEqual(where, { id: 20, aluno_id: 10 });
        assert.deepEqual(data, { ocorrido_em: new Date('2026-11-14T17:30:00Z') });
        return { id: 20, ...data };
    });
    const res = resposta();
    await controller.editarOcorrencia({ params, body: { hora: '14:30' } }, res);
    assert.equal(res.statusCode, 200);
});

test('PATCH de texto altera somente o texto e rejeita corpo vazio e data futura', async (t) => {
    simular(t);
    simularMetodo(t, prisma.ocorrencia_aluno, 'findUnique', async () => ({ ocorrido_em: new Date('2026-11-15T12:00:00Z') }));
    const update = simularMetodo(t, prisma.ocorrencia_aluno, 'update', async ({ data }) => {
        assert.deepEqual(data, { resumo: 'Resumo corrigido' });
        return data;
    });
    const res = resposta();
    await controller.editarOcorrencia({ params, body: { resumo: 'Resumo corrigido' } }, res);
    assert.equal(res.statusCode, 200);
    for (const body of [{}, { data: '2026-11-16' }]) {
        const erro = resposta();
        await controller.editarOcorrencia({ params, body }, erro);
        assert.equal(erro.statusCode, 400);
    }
    assert.equal(update.mock.callCount(), 1);
});

test('edição e exclusão de ocorrência de outro aluno retornam 404', async (t) => {
    simularMetodo(t, prisma.ocorrencia_aluno, 'findUnique', async () => null);
    simularMetodo(t, prisma.ocorrencia_aluno, 'deleteMany', async ({ where }) => {
        assert.deepEqual(where, { id: 20, aluno_id: 10 });
        return { count: 0 };
    });
    for (const acao of ['editarOcorrencia', 'excluirOcorrencia']) {
        const res = resposta();
        await controller[acao]({ params, body: { resumo: 'Corrigido' } }, res);
        assert.equal(res.statusCode, 404);
    }
});

test('exclusão remove apenas a ocorrência indicada e retorna 204', async (t) => {
    simularMetodo(t, prisma.ocorrencia_aluno, 'deleteMany', async () => ({ count: 1 }));
    const res = resposta();
    await controller.excluirOcorrencia({ params }, res);
    assert.equal(res.statusCode, 204);
});

test('listagem exige aluno existente e ordena por data do fato e ID', async (t) => {
    simular(t);
    simularMetodo(t, prisma.ocorrencia_aluno, 'findMany', async ({ where, orderBy }) => {
        assert.deepEqual(where, { aluno_id: 10 });
        assert.deepEqual(orderBy, [{ ocorrido_em: 'desc' }, { id: 'desc' }]);
        return [];
    });
    const res = resposta();
    await controller.listarOcorrencias({ params }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, []);
    prisma.aluno.findUnique = async () => null;
    const inexistente = resposta();
    await controller.listarOcorrencias({ params }, inexistente);
    assert.equal(inexistente.statusCode, 404);
});

test('administrador e professor podem gerenciar ocorrências; sessão é obrigatória', () => {
    const middleware = exigirPermissao('ocorrencias:gerenciar');
    for (const role of ['admin', 'professor']) {
        let permitido = false;
        middleware({ usuario: { role } }, resposta(), () => { permitido = true; });
        assert.equal(permitido, true);
    }
    const res = resposta();
    middleware({}, res, () => assert.fail('Não deve aceitar usuário sem sessão.'));
    assert.equal(res.statusCode, 401);
});
