const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { criarModalidadeDTO } = require('../dtos/modalidadeDTO');
const { criarAtendimentoDTO, editarAtendimentoDTO } = require('../dtos/atendimentoDTO');
const { criarModalidadeService, listarModalidadesService, validarModalidade, comNomeModalidade } = require('./modalidadeService');

function simular(t, metodo, fn) {
    const original = prisma.modalidade[metodo];
    t.after(() => { prisma.modalidade[metodo] = original; });
    prisma.modalidade[metodo] = t.mock.fn(fn);
}

test('modalidade exige somente nome válido, remove espaços das extremidades e limita tamanho', () => {
    assert.deepEqual(criarModalidadeDTO.parse({ nome: '  Psicologia  ' }), { nome: 'Psicologia' });
    for (const dados of [{}, { nome: '' }, { nome: ' \t ' }, { nome: 'a'.repeat(201) }, { nome: 'Nova', id: 5 }]) {
        assert.equal(criarModalidadeDTO.safeParse(dados).success, false);
    }
});

test('duplicidade concorrente é convertida em conflito e falhas inesperadas são preservadas', async (t) => {
    simular(t, 'create', async () => { throw Object.assign(new Error('duplicado'), { code: 'P2002' }); });
    await assert.rejects(criarModalidadeService({ nome: 'PSICOLOGIA' }), { statusCode: 409 });
    const falha = new Error('banco'); prisma.modalidade.create = async () => { throw falha; };
    await assert.rejects(criarModalidadeService({ nome: 'Nova' }), (erro) => erro === falha);
});

test('consulta completa para seletores não limita modalidades a vinte registros', async (t) => {
    const itens = Array.from({ length: 27 }, (_, i) => ({ id: i + 1, nome: `Modalidade ${i}` }));
    simular(t, 'findMany', async ({ where, select }) => { assert.deepEqual(where, {}); assert.deepEqual(select, { id: true, nome: true }); return itens; });
    assert.equal((await listarModalidadesService()).length, 27);
});

test('paginação usa limite existente e mantém nome e ID na ordenação', async (t) => {
    const original = prisma.$queryRaw;
    t.after(() => { prisma.$queryRaw = original; });
    let consulta = 0;
    prisma.$queryRaw = async (sql) => {
        assert.match(sql.sql, /modalidade m/);
        return ++consulta % 2 ? Array.from({ length: 21 }, (_, i) => ({ id: i + 1, chave: `Modalidade ${i}` })) : [{ total: 27n }];
    };
    simular(t, 'findMany', async ({ where }) => where.id.in.map((id) => ({ id, nome: `Modalidade ${id - 1}` })));
    const pagina = await listarModalidadesService({ paginado: 'true', busca: '', status: 'TODOS' });
    assert.equal(pagina.itens.length, 20); assert.equal(pagina.total, 27); assert.equal(pagina.tem_mais, true);
    assert.ok(pagina.proximo_cursor);
});

test('atendimento usa ID válido e mantém modalidade legível sem expor a relação interna', async () => {
    const tx = { modalidade: { findUnique: async ({ where }) => where.id === 1 ? { id: 1, nome: 'Psicologia' } : null } };
    assert.equal((await validarModalidade(tx, 1)).nome, 'Psicologia');
    await assert.rejects(validarModalidade(tx, 2), { statusCode: 404 });
    assert.deepEqual(comNomeModalidade({ id: 3, modalidade_id: 1, modalidade_cadastrada: { nome: 'Psicologia' } }), { id: 3, modalidade_id: 1, modalidade: 'Psicologia' });
    assert.equal(editarAtendimentoDTO.safeParse({ modalidade_id: 1 }).success, true);
    assert.equal(editarAtendimentoDTO.safeParse({ modalidade: 'Texto antigo' }).success, false);
    assert.equal(criarAtendimentoDTO.safeParse({ modalidade: 'Psicologia' }).success, false);
});

test('HTTP de modalidades mantém permissões, validação e ausência de edição e exclusão', async (t) => {
    const express = require('express');
    simular(t, 'create', async ({ data }) => ({ id: 1, ...data }));
    simular(t, 'findMany', async () => [{ id: 1, nome: 'Psicologia' }]);
    const app = express(); app.use(express.json());
    app.use((req, res, next) => { if (req.get('x-test-role')) req.usuario = { role: req.get('x-test-role') }; next(); });
    app.use('/api', require('../routes/modalidadeRoutes'));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}/api/modalidades`;
    for (const [role, status] of [[undefined, 401], ['professor', 403], ['admin', 200]]) {
        assert.equal((await fetch(url, { headers: role ? { 'x-test-role': role } : {} })).status, status);
    }
    const headers = { 'x-test-role': 'admin', 'content-type': 'application/json' };
    assert.equal((await fetch(url, { method: 'POST', headers, body: JSON.stringify({ nome: ' ' }) })).status, 400);
    const criado = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ nome: ' Nova ' }) });
    assert.equal(criado.status, 201); assert.equal((await criado.json()).nome, 'Nova');
    for (const method of ['PATCH', 'DELETE']) assert.equal((await fetch(`${url}/1`, { method, headers })).status, 404);
});
