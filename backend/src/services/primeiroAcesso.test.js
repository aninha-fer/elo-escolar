const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const argon2 = require('argon2');
const prisma = require('../prismaClient');
const { trocarSenhaInicial, removerVersao } = require('./authService');
const { trocarSenhaInicialDTO } = require('../dtos/authDTO');
const { requireAuth } = require('../middlewares/requireAuth');
const { exigirSenhaDefinitiva } = require('../middlewares/exigirSenhaDefinitiva');
const { alterarSenhaInicial } = require('../controllers/authController');

function conta() {
    return { id: 1, email: 'teste@example.com', role: 'admin', status: 'ATIVO', deleted_at: null,
        deve_trocar_senha: true, senha_versao: 1, senha_hash: 'temporaria',
        pessoa: { nome: 'Teste', status_geral: 'ATIVO', funcionario: null } };
}

function simular(t, usuario = conta()) {
    const originais = { findUnique: prisma.usuario.findUnique, updateMany: prisma.usuario.updateMany };
    t.after(() => Object.assign(prisma.usuario, originais));
    prisma.usuario.findUnique = t.mock.fn(async () => structuredClone(usuario));
    t.mock.method(argon2, 'verify', async (hash, senha) => hash === senha);
    t.mock.method(argon2, 'hash', async (senha) => `hash:${senha}`);
    prisma.usuario.updateMany = t.mock.fn(async ({ where, data }) => {
        assert.equal(where.deleted_at, null);
        assert.equal(where.status, 'ATIVO');
        assert.equal(where.pessoa.is.status_geral, 'ATIVO');
        if (usuario.senha_versao !== where.senha_versao || !usuario.deve_trocar_senha || usuario.status !== 'ATIVO' || usuario.deleted_at) return { count: 0 };
        usuario.senha_hash = data.senha_hash;
        usuario.senha_versao++;
        usuario.deve_trocar_senha = false;
        return { count: 1 };
    });
    return usuario;
}

test('senha definitiva valida composição, confirmação e campos extras sem retirar espaços', () => {
    for (const senha of ['Curta1', 'minuscula1', 'MAIUSCULA1', 'SemNumero', 'A1' + 'a'.repeat(99)]) {
        assert.equal(trocarSenhaInicialDTO.safeParse({ nova_senha: senha, confirmacao_senha: senha }).success, false);
    }
    assert.equal(trocarSenhaInicialDTO.safeParse({ nova_senha: 'Valida123', confirmacao_senha: 'Outra123' }).success, false);
    assert.equal(trocarSenhaInicialDTO.safeParse({ nova_senha: 'Valida123', confirmacao_senha: 'Valida123', id: 2 }).success, false);
    const senha = ' Valida123 ';
    assert.equal(trocarSenhaInicialDTO.parse({ nova_senha: senha, confirmacao_senha: senha }).nova_senha, senha);
});

test('troca grava hash, remove pendência e incrementa versão sem expor versão pública', async (t) => {
    const usuario = simular(t);
    const identidade = await trocarSenhaInicial(1, 1, 'Definitiva123');
    assert.equal(usuario.senha_hash, 'hash:Definitiva123');
    assert.equal(usuario.senha_versao, 2);
    assert.equal(usuario.deve_trocar_senha, false);
    assert.equal(identidade.senha_versao, 2);
    assert.equal('senha_versao' in removerVersao(identidade), false);
    assert.equal('senha_hash' in identidade, false);
});

test('temporária não pode ser reutilizada e não grava nada', async (t) => {
    simular(t);
    await assert.rejects(trocarSenhaInicial(1, 1, 'temporaria'), { statusCode: 400 });
    assert.equal(prisma.usuario.updateMany.mock.callCount(), 0);
});

test('duas trocas simultâneas com a mesma versão permitem somente uma gravação', async (t) => {
    const usuario = simular(t);
    const resultados = await Promise.allSettled([trocarSenhaInicial(1, 1, 'Primeira123'), trocarSenhaInicial(1, 1, 'Segunda123')]);
    assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(resultados.find((r) => r.status === 'rejected').reason.statusCode, 401);
    assert.equal(usuario.senha_versao, 2);
});

for (const [nome, alterar] of [
    ['inativo', (u) => { u.status = 'INATIVO'; }],
    ['pessoa inativa', (u) => { u.pessoa.status_geral = 'INATIVO'; }],
    ['excluído', (u) => { u.deleted_at = new Date(); }],
    ['funcionário excluído', (u) => { u.pessoa.funcionario = { deleted_at: new Date() }; }],
    ['versão antiga', (u) => { u.senha_versao = 2; }],
    ['sem pendência', (u) => { u.deve_trocar_senha = false; }],
]) {
    test(`troca rejeita usuário ${nome}`, async (t) => {
        const usuario = conta(); alterar(usuario); simular(t, usuario);
        await assert.rejects(trocarSenhaInicial(1, 1, 'Definitiva123'), { statusCode: nome === 'sem pendência' ? 409 : 401 });
        assert.equal(prisma.usuario.updateMany.mock.callCount(), 0);
    });
}

test('inativação entre leitura e escrita impede salvar a senha', async (t) => {
    const usuario = simular(t);
    t.mock.method(argon2, 'hash', async () => { usuario.status = 'INATIVO'; return 'hash'; });
    await assert.rejects(trocarSenhaInicial(1, 1, 'Definitiva123'), { statusCode: 401 });
    assert.equal(usuario.senha_versao, 1);
});

test('falha ao salvar sessão após trocar senha permite novo login com a nova credencial', async (t) => {
    const usuario = simular(t);
    const req = { usuario: { id: 1 }, body: { nova_senha: 'Definitiva123', confirmacao_senha: 'Definitiva123' },
        session: { senha_versao: 1, regenerate(cb) { cb(); }, save(cb) { cb(new Error('store indisponível')); }, destroy(cb) { cb(); } } };
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, clearCookie() {} };
    await alterarSenhaInicial(req, res);
    assert.equal(res.code, 401);
    assert.equal(res.body.codigo, 'SENHA_ALTERADA_NOVO_LOGIN');
    assert.equal(usuario.senha_hash, 'hash:Definitiva123');
    assert.equal(usuario.deve_trocar_senha, false);
});

test('HTTP: sessão restrita em ambos os perfis, origem, troca e invalidação das outras sessões', async (t) => {
    process.env.APP_ORIGIN = 'http://localhost:5173';
    const { authPublicas, authProtegidas } = require('../routes/authRoutes');
    const { exigirOrigemPermitida } = require('../middlewares/exigirOrigemPermitida');
    const usuario = simular(t);
    const sessoes = new Map();
    const novaSessao = (versao = 1) => ({ usuarioId: 1, senha_versao: versao, autenticadoEm: Date.now(),
        regenerate(cb) { cb(); }, save(cb) { cb(); }, destroy(cb) { delete this.usuarioId; cb(); } });
    sessoes.set('a', novaSessao()); sessoes.set('b', novaSessao()); sessoes.set('legada', novaSessao(undefined));
    delete sessoes.get('legada').senha_versao;
    const app = express(); app.use(express.json());
    app.use((req, res, next) => { req.session = sessoes.get(req.get('X-Sessao')) ?? novaSessao(); next(); });
    app.use('/auth', authPublicas);
    app.use(requireAuth);
    app.use((req, res, next) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? next() : exigirOrigemPermitida(req, res, next));
    app.use('/auth', authProtegidas); app.use(exigirSenhaDefinitiva);
    app.get('/negocio', (req, res) => res.json({ ok: true }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const requisitar = (path, sessao = 'a', options = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
        ...options, headers: { 'X-Sessao': sessao, 'Content-Type': 'application/json', Origin: process.env.APP_ORIGIN, ...options.headers },
    });
    const login = await requisitar('/auth/login', 'a', { method: 'POST', body: JSON.stringify({ email: usuario.email, senha: 'temporaria' }) });
    assert.equal(login.status, 200);
    const identidadeLogin = await login.json();
    assert.equal(identidadeLogin.deve_trocar_senha, true);
    assert.equal('senha_versao' in identidadeLogin, false);
    assert.equal(sessoes.get('a').senha_versao, 1);
    for (const role of ['admin', 'professor']) {
        usuario.role = role;
        const bloqueio = await requisitar('/negocio');
        assert.equal(bloqueio.status, 403);
        assert.equal((await bloqueio.json()).codigo, 'TROCA_SENHA_OBRIGATORIA');
        const me = await requisitar('/auth/me'); assert.equal(me.status, 200);
        assert.equal('senha_versao' in await me.json(), false);
    }
    assert.equal((await requisitar('/negocio', 'legada')).status, 401);
    assert.equal((await requisitar('/auth/primeiro-acesso/senha', 'a', { method: 'POST', headers: { Origin: 'http://outra.example' }, body: '{}' })).status, 403);
    const troca = await requisitar('/auth/primeiro-acesso/senha', 'a', { method: 'POST', body: JSON.stringify({ nova_senha: 'Definitiva123', confirmacao_senha: 'Definitiva123' }) });
    assert.equal(troca.status, 200);
    assert.equal((await troca.json()).deve_trocar_senha, false);
    assert.equal((await requisitar('/negocio')).status, 200);
    assert.equal((await requisitar('/negocio', 'b')).status, 401);
    usuario.senha_versao++; usuario.deve_trocar_senha = true;
    assert.equal((await requisitar('/negocio')).status, 401);
    sessoes.set('c', novaSessao(usuario.senha_versao));
    for (let tentativa = 0; tentativa < 9; tentativa++) {
        assert.equal((await requisitar('/auth/primeiro-acesso/senha', 'c', { method: 'POST', body: '{}' })).status, 400);
    }
    assert.equal((await requisitar('/auth/primeiro-acesso/senha', 'c', { method: 'POST', body: '{}' })).status, 429);
    const montagem = require('node:fs').readFileSync(require.resolve('../server'), 'utf8');
    assert.ok(montagem.indexOf("api.use('/auth', authProtegidas)") < montagem.indexOf('api.use(exigirSenhaDefinitiva)'));
    assert.ok(montagem.indexOf('api.use(exigirSenhaDefinitiva)') < montagem.indexOf('api.use(alunoLeituraRoutes)'));
});
