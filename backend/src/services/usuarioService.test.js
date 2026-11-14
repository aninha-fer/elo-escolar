const test = require('node:test');
const assert = require('node:assert/strict');
const argon2 = require('argon2');
const prisma = require('../prismaClient');
const { criarUsuario } = require('../controllers/usuarioController');

const conta = { modo: 'existente', pessoa_id: 50, email: 'conta@example.com', role: 'professor', senha: 'senha-de-teste' };
function resposta() {
    return { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
function simular(t, pessoa, falhaCriacao) {
    for (const [entidade, metodo, fn] of [
        ['pessoa', 'findUnique', async ({ where }) => { assert.equal(where.id, 50); return pessoa; }],
        ['usuario', 'findFirst', async () => null],
        ['usuario', 'create', async ({ data, select }) => {
            if (falhaCriacao) throw falhaCriacao;
            assert.equal(data.senha_hash, 'hash-simulado');
            assert.equal('senha' in data, false);
            assert.equal('senha_hash' in select, false);
            return { id: 7, pessoa_id: 50, email: data.email, role: data.role, pessoa: { nome: 'Maria' } };
        }],
    ]) {
        const original = prisma[entidade][metodo];
        t.after(() => { prisma[entidade][metodo] = original; });
        prisma[entidade][metodo] = t.mock.fn(fn);
    }
    t.mock.method(argon2, 'hash', async () => 'hash-simulado');
}

test('pessoa com conta recebe 409 e mensagem associada ao código, sem gerar senha ou gravar', async (t) => {
    simular(t, { status_geral: 'ATIVO', usuario: { id: 3 } });
    const res = resposta();
    await criarUsuario({ body: conta }, res);
    assert.equal(res.code, 409);
    assert.deepEqual(res.body, { erro: 'Esta pessoa já possui um usuário cadastrado.',
        erros: [{ campo: 'pessoa_id', mensagem: 'Esta pessoa já possui um usuário cadastrado.' }] });
    assert.equal(argon2.hash.mock.callCount(), 0);
    assert.equal(prisma.usuario.create.mock.callCount(), 0);
});

for (const [pessoa, code] of [[null, 404], [{ status_geral: 'INATIVO', usuario: null }, 400]]) {
    test(`pessoa indisponível retorna ${code} com erro no campo pessoa_id`, async (t) => {
        simular(t, pessoa);
        const res = resposta();
        await criarUsuario({ body: conta }, res);
        assert.equal(res.code, code);
        assert.equal(res.body.erros[0].campo, 'pessoa_id');
        assert.equal(prisma.usuario.create.mock.callCount(), 0);
    });
}

for (const modo of ['nova', 'existente']) {
    test(`cadastro ${modo} mantém vínculo correto e retorna somente dados públicos`, async (t) => {
        simular(t, { status_geral: 'ATIVO', usuario: null });
        const body = modo === 'nova' ? { ...conta, modo, pessoa: { nome: ' Maria ' } } : conta;
        if (modo === 'nova') delete body.pessoa_id;
        const res = resposta();
        await criarUsuario({ body }, res);
        assert.equal(res.code, 201);
        const data = prisma.usuario.create.mock.calls[0].arguments[0].data;
        assert.deepEqual(data.pessoa, modo === 'nova' ? { create: { nome: 'Maria' } } : { connect: { id: 50, status_geral: 'ATIVO' } });
        assert.equal(prisma.pessoa.findUnique.mock.callCount(), modo === 'nova' ? 0 : 1);
        assert.deepEqual(res.body, { id: 7, pessoa_id: 50, nome: 'Maria', email: conta.email, role: 'professor' });
    });
}

for (const target of ['pessoa_id', 'email']) {
    test(`duplicidade concorrente de ${target} retorna conflito no campo correspondente`, async (t) => {
        simular(t, { status_geral: 'ATIVO', usuario: null }, { code: 'P2002', meta: { target: [target] } });
        const res = resposta();
        await criarUsuario({ body: conta }, res);
        assert.equal(res.code, 409);
        assert.equal(res.body.erros[0].campo, target);
    });
}

test('código inválido e senha acima de 100 caracteres são recusados antes de acessar o banco', async (t) => {
    simular(t, null);
    for (const body of [{ ...conta, pessoa_id: 0 }, { ...conta, pessoa_id: 1.5 }, { ...conta, pessoa_id: 2147483648 }, { ...conta, senha: 'a'.repeat(101) }]) {
        const res = resposta();
        await criarUsuario({ body }, res);
        assert.equal(res.code, 400);
        assert.ok(res.body.erros.length);
    }
    assert.equal(prisma.pessoa.findUnique.mock.callCount(), 0);
});

test('busca por nome removida não permanece disponível na API de usuários', async (t) => {
    const express = require('express');
    const { createServer } = require('node:http');
    const routes = require('../routes/usuarioRoutes');
    const app = express();
    app.use('/api', (req, res, next) => { req.usuario = { role: 'admin' }; next(); }, routes);
    const server = createServer(app);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/pessoas-elegiveis?q=Maria`);
    assert.equal(response.status, 404);
});
