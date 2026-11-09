const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { listarAmbientesService } = require('./ambienteService');
const { listarAmbientes } = require('../controllers/ambienteController');

test('consulta salas por nome com contrato limitado a id e nome', async (t) => {
    const original = prisma.ambiente.findMany;
    t.after(() => { prisma.ambiente.findMany = original; });
    prisma.ambiente.findMany = async (query) => {
        assert.deepEqual(query, { select: { id: true, nome: true }, orderBy: [{ nome: 'asc' }, { id: 'asc' }] });
        return [{ id: 1, nome: 'Sala A' }];
    };
    assert.deepEqual(await listarAmbientesService(), [{ id: 1, nome: 'Sala A' }]);
});

test('consulta de salas não expõe erro interno ao cliente', async (t) => {
    const original = prisma.ambiente.findMany;
    t.after(() => { prisma.ambiente.findMany = original; });
    prisma.ambiente.findMany = async () => { throw new Error('Detalhes de conexão'); };
    t.mock.method(console, 'error', () => {});
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await listarAmbientes({}, res);
    assert.equal(res.code, 500);
    assert.deepEqual(res.body, { erro: 'Não foi possível carregar as salas.' });
});
