const test = require('node:test');
const assert = require('node:assert/strict');
const argon2 = require('argon2');
const prisma = require('../prismaClient');
const { criarUsuario, editarUsuario } = require('../controllers/usuarioController');

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
            return { id: 7, pessoa_id: 50, email: data.email, role: data.role, status: 'ATIVO', pessoa: { nome: 'Maria' } };
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
        assert.deepEqual(res.body, { id: 7, pessoa_id: 50, nome: 'Maria', email: conta.email, role: 'professor', status: 'ATIVO' });
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

function simularEdicao(t, { existe = true, emailDuplicado = false, falha } = {}) {
    const salvo = { id: 7, pessoa_id: 50, email: conta.email, role: 'professor', status: 'ATIVO', pessoa: { nome: 'Maria' } };
    for (const [metodo, fn] of [
        ['findUnique', async ({ where }) => { assert.deepEqual(where, { id: 7 }); return existe ? { id: 7 } : null; }],
        ['findFirst', async ({ where }) => {
            assert.deepEqual(where.id, { not: 7 });
            assert.equal(where.email.mode, 'insensitive');
            return emailDuplicado ? { id: 8 } : null;
        }],
        ['update', async ({ where, data, select }) => {
            assert.deepEqual(where, { id: 7 });
            assert.equal('senha_hash' in select, false);
            if (falha) throw falha;
            return { ...salvo, ...data, pessoa: data.pessoa ? { nome: data.pessoa.update.nome } : salvo.pessoa };
        }],
    ]) {
        const original = prisma.usuario[metodo];
        t.after(() => { prisma.usuario[metodo] = original; });
        prisma.usuario[metodo] = t.mock.fn(fn);
    }
    t.mock.method(argon2, 'hash', async () => 'novo-hash');
}

for (const [body, esperado] of [
    [{ role: 'admin' }, { role: 'admin' }],
    [{ email: ' CONTA@example.com ' }, { email: 'conta@example.com' }],
    [{ senha: 'nova-senha-teste' }, { senha_hash: 'novo-hash' }],
    [{ pessoa: { nome: ' Maria Silva ' } }, { pessoa: { update: { nome: 'Maria Silva' } } }],
    [{ status: 'INATIVO' }, { status: 'INATIVO' }],
    [{ status: 'ATIVO' }, { status: 'ATIVO' }],
]) {
    test(`edição aceita somente ${Object.keys(body)[0]} e preserva campos omitidos`, async (t) => {
        simularEdicao(t);
        const res = resposta();
        await editarUsuario({ params: { id: '7' }, body }, res);
        assert.equal(res.code, 200);
        assert.deepEqual(prisma.usuario.update.mock.calls[0].arguments[0].data, esperado);
        assert.equal(argon2.hash.mock.callCount(), body.senha ? 1 : 0);
        assert.equal(prisma.usuario.findFirst.mock.callCount(), body.email ? 1 : 0);
        assert.equal('senha' in res.body, false);
        assert.equal('senha_hash' in res.body, false);
        if (!body.email) assert.equal(res.body.email, conta.email);
        if (!body.role) assert.equal(res.body.role, 'professor');
    });
}

test('edição recusa corpo vazio, campos inválidos e ID inválido sem consultar o banco', async (t) => {
    simularEdicao(t);
    for (const body of [{}, { pessoa: {} }, { senha: '' }, { senha: '1234567' }, { email: '' }, { pessoa: { nome: ' ' } }, { role: 'outro' },
        { status: 'PROVISORIO' }, { senha: null }, { pessoa_id: 1 }, { pessoa: { telefone: '123' } }]) {
        const res = resposta();
        await editarUsuario({ params: { id: '7' }, body }, res);
        assert.equal(res.code, 400);
    }
    for (const id of ['abc', '0', '-1', '1.5', '2147483648', undefined]) {
        const res = resposta();
        await editarUsuario({ params: { id }, body: { role: 'admin' } }, res);
        assert.equal(res.code, 400);
    }
    assert.equal(prisma.usuario.findUnique.mock.callCount(), 0);
    assert.equal(prisma.usuario.update.mock.callCount(), 0);
});

test('edição de conta inexistente retorna 404', async (t) => {
    simularEdicao(t, { existe: false });
    const res = resposta();
    await editarUsuario({ params: { id: '7' }, body: { role: 'admin' } }, res);
    assert.equal(res.code, 404);
    assert.equal(prisma.usuario.update.mock.callCount(), 0);
});

test('e-mail de outra conta impede edição com 409', async (t) => {
    simularEdicao(t, { emailDuplicado: true });
    const res = resposta();
    await editarUsuario({ params: { id: '7' }, body: { email: 'outra@example.com' } }, res);
    assert.equal(res.code, 409);
    assert.equal(res.body.erros[0].campo, 'email');
    assert.equal(prisma.usuario.update.mock.callCount(), 0);
});

for (const [falha, esperado] of [[{ code: 'P2025' }, 404], [{ code: 'P2002', meta: { target: ['email'] } }, 409]]) {
    test(`falha concorrente ${falha.code} recebe resposta ${esperado}`, async (t) => {
        simularEdicao(t, { falha });
        const res = resposta();
        await editarUsuario({ params: { id: '7' }, body: { email: 'conta@example.com' } }, res);
        assert.equal(res.code, esperado);
    });
}
