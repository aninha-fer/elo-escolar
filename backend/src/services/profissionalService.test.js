const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { criarProfissionalService } = require('./profissionalService');
const { criarProfissional, listarProfissionais } = require('../controllers/profissionalController');

function resposta() {
    return {
        statusCode: null,
        body: null,
        status(codigo) { this.statusCode = codigo; return this; },
        json(dados) { this.body = dados; return this; },
    };
}

test('cadastro recebe cargo do DTO e cria pessoa e funcionário na mesma transação', async (t) => {
    const original = prisma.$transaction;
    t.after(() => { prisma.$transaction = original; });
    const chamadas = [];
    prisma.$transaction = async (callback, options) => {
        assert.equal(options.isolationLevel, 'ReadCommitted');
        return callback({
            pessoa: { create: async ({ data }) => {
                chamadas.push('pessoa');
                assert.deepEqual(data, { nome: 'Maria Silva', telefone: '51999999999', status_geral: 'ATIVO' });
                return { id: 50, ...data };
            } },
            funcionario: { create: async ({ data }) => {
                chamadas.push('funcionario');
                assert.deepEqual(data, { pessoa_id: 50, cargo: 'Professor' });
                return { id: 7, ...data };
            } },
        });
    };
    const res = resposta();
    await criarProfissional({ body: { nome: ' Maria Silva ', cargo: ' Professor ', telefone: '51999999999', email: '' } }, res);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(chamadas, ['pessoa', 'funcionario']);
    assert.deepEqual(res.body, { id: 7, pessoa_id: 50, nome: 'Maria Silva', telefone: '51999999999', cargo: 'Professor', status_geral: 'ATIVO' });
});

test('DTO devolve 400 para nome ou cargo ausente ou em branco antes de gravar', async (t) => {
    const original = prisma.$transaction;
    t.after(() => { prisma.$transaction = original; });
    prisma.$transaction = () => { assert.fail('Não deve iniciar transação com entrada inválida.'); };
    for (const body of [{ nome: 'Maria' }, { nome: 'Maria', cargo: '  ' }, { nome: '  ', cargo: 'Professor' }]) {
        const res = resposta();
        await criarProfissional({ body }, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.erros.length > 0);
    }
});

test('e-mail preenchido é recusado explicitamente sem descartar o dado ou iniciar gravação', async (t) => {
    const original = prisma.$transaction;
    t.after(() => { prisma.$transaction = original; });
    prisma.$transaction = () => { assert.fail('Não deve gravar quando o e-mail não pode ser persistido.'); };
    const res = resposta();
    await criarProfissional({ body: { nome: 'Maria', cargo: 'Professor', email: 'maria@example.com' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.erro, 'O cadastro de e-mail do profissional ainda não está disponível.');
});

test('cadastro sem telefone grava null e propaga falha do funcionário à transação', async (t) => {
    const original = prisma.$transaction;
    t.after(() => { prisma.$transaction = original; });
    const falha = new Error('Falha simulada no funcionário');
    prisma.$transaction = async (callback) => callback({
        pessoa: { create: async ({ data }) => {
            assert.equal(data.telefone, null);
            return { id: 50, ...data };
        } },
        funcionario: { create: async () => { throw falha; } },
    });
    await assert.rejects(criarProfissionalService({ nome: 'Maria', cargo: 'Professor' }), (error) => error === falha);
});

test('listagem ordena por nome relacionado e preserva o contrato funcao sem expor dados internos', async (t) => {
    const original = prisma.funcionario.findMany;
    t.after(() => { prisma.funcionario.findMany = original; });
    prisma.funcionario.findMany = async (query) => {
        assert.deepEqual(query.orderBy, [{ pessoa: { nome: 'asc' } }, { id: 'asc' }]);
        assert.deepEqual(query.select.pessoa.select, { nome: true, telefone: true, status_geral: true });
        return [{ id: 7, cargo: 'Professor', pessoa: { nome: 'Maria', telefone: null, status_geral: 'ATIVO' } }];
    };
    const res = resposta();
    await listarProfissionais({}, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, [{ id: 7, nome: 'Maria', telefone: null, funcao: 'Professor', status_geral: 'ATIVO' }]);
});
