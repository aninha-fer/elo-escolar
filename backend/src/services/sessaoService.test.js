const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middlewares/requireAuth');
const { atividade, me, logout } = require('../controllers/authController');
const { registrarAtividade } = require('./sessaoService');
const { INATIVIDADE_MAXIMA_MS, DURACAO_MAXIMA_MS } = require('../config/prazosSessao');

const AGORA = Date.UTC(2026, 10, 21, 12);
const identidade = { id: 1, email: 'teste@example.com', role: 'professor', status: 'ATIVO',
    senha_versao: 1, deve_trocar_senha: true, pessoa: { nome: 'Teste', status_geral: 'ATIVO' } };

function simular(t, objeto, campo, fn) {
    const original = objeto[campo];
    t.after(() => { objeto[campo] = original; });
    objeto[campo] = t.mock.fn(fn);
}

for (const [nome, campos, permitido] of [
    ['um milissegundo antes da inatividade', { ultimaAtividadeEm: AGORA - INATIVIDADE_MAXIMA_MS + 1 }, true],
    ['exatamente sessenta minutos', { ultimaAtividadeEm: AGORA - INATIVIDADE_MAXIMA_MS }, false],
    ['inatividade vencida', { ultimaAtividadeEm: AGORA - INATIVIDADE_MAXIMA_MS - 1 }, false],
    ['um milissegundo antes das oito horas', { autenticadoEm: AGORA - DURACAO_MAXIMA_MS + 1 }, true],
    ['exatamente oito horas mesmo com atividade recente', { autenticadoEm: AGORA - DURACAO_MAXIMA_MS }, false],
    ['sessão legada', { ultimaAtividadeEm: undefined }, false],
    ['atividade inválida', { ultimaAtividadeEm: 'agora' }, false],
    ['atividade no futuro', { ultimaAtividadeEm: AGORA + 1 }, false],
]) {
    test(`requireAuth valida ${nome}`, async (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: AGORA });
        simular(t, prisma.usuario, 'findUnique', async () => identidade);
        let liberada = false, destruida = false;
        const req = { session: { usuarioId: 1, senha_versao: 1, autenticadoEm: AGORA, ultimaAtividadeEm: AGORA,
            ...campos, destroy(cb) { destruida = true; cb(); } } };
        const res = { status(code) { this.code = code; return this; }, json() { return this; }, clearCookie() {} };
        await requireAuth(req, res, () => { liberada = true; });
        assert.equal(liberada, permitido);
        assert.equal(destruida, !permitido);
        if (!permitido) assert.equal(res.code, 401);
    });
}

function adiada() {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
}

async function prepararHttp(t) {
    const store = new session.MemoryStore();
    const gravacoes = t.mock.method(store, 'set');
    let versao = 1;
    simular(t, prisma.usuario, 'findUnique', async () => ({ ...identidade, senha_versao: versao }));
    const app = express();
    app.use(session({ secret: 'segredo-apenas-para-testes', store, resave: false, saveUninitialized: false,
        rolling: true, cookie: { maxAge: INATIVIDADE_MAXIMA_MS } }));
    app.post('/iniciar', (req, res) => {
        Object.assign(req.session, { usuarioId: 1, senha_versao: versao,
            autenticadoEm: Date.now(), ultimaAtividadeEm: Date.now() });
        res.json({ ok: true });
    });
    app.use(requireAuth);
    app.get('/me', me); app.post('/atividade', atividade); app.post('/logout', logout);
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}`;
    const inicio = await fetch(`${url}/iniciar`, { method: 'POST' });
    await inicio.json();
    const cookie = inicio.headers.get('set-cookie').split(';')[0];
    const sid = Object.keys(store.sessions)[0];
    return { store, sid, gravacoes, mudarSenha() { versao++; },
        requisitar: (path, method = 'POST') => fetch(`${url}${path}`, { method, headers: { Cookie: cookie } }),
        ler: () => store.sessions[sid] && JSON.parse(store.sessions[sid]),
        gravar: (dados) => { store.sessions[sid] = JSON.stringify(dados); } };
}

test('HTTP: consultas automáticas não alteram atividade nem o início das oito horas', async (t) => {
    const h = await prepararHttp(t);
    const antes = h.ler();
    for (let i = 0; i < 3; i++) assert.equal((await h.requisitar('/me', 'GET')).status, 200);
    assert.equal(h.ler().ultimaAtividadeEm, antes.ultimaAtividadeEm);
    assert.equal(h.ler().autenticadoEm, antes.autenticadoEm);
    assert.equal(h.gravacoes.mock.callCount(), 1);
});

test('HTTP: renovação confirma persistência e não dispara save automático da sessão antiga', async (t) => {
    const h = await prepararHttp(t), liberar = adiada(), chegou = adiada();
    const antes = h.ler();
    simular(t, prisma, '$executeRaw', async () => {
        chegou.resolve(); await liberar.promise;
        h.gravar({ ...h.ler(), ultimaAtividadeEm: antes.ultimaAtividadeEm + 10 });
        return 1;
    });
    let respondeu = false;
    const resposta = h.requisitar('/atividade').then((r) => { respondeu = true; return r; });
    await chegou.promise;
    assert.equal(respondeu, false);
    liberar.resolve(); assert.equal((await resposta).status, 204);
    const depois = h.ler();
    assert.equal(depois.ultimaAtividadeEm, antes.ultimaAtividadeEm + 10);
    assert.equal(depois.autenticadoEm, antes.autenticadoEm);
    assert.equal(depois.senha_versao, antes.senha_versao);
    assert.equal(h.gravacoes.mock.callCount(), 1);
});

for (const momento of ['antes da gravação', 'depois da gravação']) {
    test(`HTTP: logout ${momento} da atividade não permite recriar sessão`, async (t) => {
        const h = await prepararHttp(t), chegou = adiada(), liberar = adiada();
        simular(t, prisma, '$executeRaw', async () => {
            if (momento === 'depois da gravação') h.gravar({ ...h.ler(), ultimaAtividadeEm: Date.now() });
            chegou.resolve(); await liberar.promise;
            return momento === 'depois da gravação' || h.ler() ? 1 : 0;
        });
        const atividadePendente = h.requisitar('/atividade'); await chegou.promise;
        assert.equal((await h.requisitar('/logout')).status, 204);
        liberar.resolve();
        assert.equal((await atividadePendente).status, momento === 'antes da gravação' ? 401 : 204);
        assert.equal(h.ler(), undefined);
        assert.equal(h.gravacoes.mock.callCount(), 1);
        assert.equal((await h.requisitar('/me', 'GET')).status, 401);
    });
}

test('HTTP: renovação rejeitada por credencial alterada mantém a sessão encerrada', async (t) => {
    const h = await prepararHttp(t), chegou = adiada(), liberar = adiada();
    simular(t, prisma, '$executeRaw', async () => { chegou.resolve(); await liberar.promise; return 0; });
    const resposta = h.requisitar('/atividade'); await chegou.promise;
    h.mudarSenha(); liberar.resolve();
    assert.equal((await resposta).status, 401);
    assert.equal(h.ler(), undefined);
});

test('HTTP: falha de persistência não confirma atividade e permite recuperação', async (t) => {
    const h = await prepararHttp(t);
    const antes = h.ler().ultimaAtividadeEm;
    simular(t, prisma, '$executeRaw', async () => { throw new Error('banco indisponível'); });
    assert.equal((await h.requisitar('/atividade')).status, 503);
    assert.equal(h.ler().ultimaAtividadeEm, antes);
    assert.equal(h.gravacoes.mock.callCount(), 1);
});

test('PostgreSQL: atualização atômica preserva atividade mais recente e não recria sessões',
    { skip: process.env.TESTAR_SESSAO_POSTGRES !== '1' }, async (t) => {
        require('dotenv').config({ quiet: true });
        t.mock.timers.enable({ apis: ['Date'], now: AGORA });
        const original = prisma.$executeRaw;
        try {
            await prisma.$transaction(async (tx) => {
                // Tabelas temporárias ocultam as tabelas reais só nesta conexão e são removidas no commit.
                await tx.$executeRawUnsafe('CREATE TEMP TABLE pessoa (id integer, status_geral text) ON COMMIT DROP');
                await tx.$executeRawUnsafe('CREATE TEMP TABLE funcionario (pessoa_id integer, deleted_at timestamp) ON COMMIT DROP');
                await tx.$executeRawUnsafe('CREATE TEMP TABLE usuario (id integer, pessoa_id integer, senha_versao integer, status text, deleted_at timestamp) ON COMMIT DROP');
                await tx.$executeRawUnsafe('CREATE TEMP TABLE session (sid text PRIMARY KEY, sess json, expire timestamp) ON COMMIT DROP');
                await tx.$executeRawUnsafe("INSERT INTO pessoa VALUES (1, 'ATIVO')");
                await tx.$executeRawUnsafe("INSERT INTO usuario VALUES (1, 1, 1, 'ATIVO', NULL)");
                const sessao = { usuarioId: 1, senha_versao: 1, autenticadoEm: AGORA, ultimaAtividadeEm: AGORA - 1000 };
                const inserir = () => tx.$executeRaw`INSERT INTO session VALUES ('teste', ${JSON.stringify(sessao)}::json, ${new Date(AGORA + INATIVIDADE_MAXIMA_MS)}::timestamp)`;
                await inserir();
                const executar = tx.$executeRaw.bind(tx), chegou = adiada(), liberar = adiada();
                let primeira = true;
                prisma.$executeRaw = async (...args) => {
                    if (primeira) { primeira = false; chegou.resolve(); await liberar.promise; }
                    return executar(...args);
                };
                const antiga = registrarAtividade('teste', sessao); await chegou.promise;
                t.mock.timers.tick(1000);
                assert.equal(await registrarAtividade('teste', sessao), true);
                liberar.resolve(); assert.equal(await antiga, true);
                const [registro] = await tx.$queryRaw`SELECT sess FROM session WHERE sid = 'teste'`;
                assert.equal(registro.sess.ultimaAtividadeEm, AGORA + 1000);
                assert.equal(registro.sess.autenticadoEm, AGORA);
                assert.equal(registro.sess.senha_versao, 1);
                await tx.$executeRaw`UPDATE usuario SET senha_versao = 2`;
                assert.equal(await registrarAtividade('teste', sessao), false);
                await tx.$executeRaw`UPDATE usuario SET senha_versao = 1`;
                await tx.$executeRaw`DELETE FROM session`;
                assert.equal(await registrarAtividade('teste', sessao), false);
                await inserir();
                await tx.$executeRaw`UPDATE session SET sess = jsonb_set(sess::jsonb, '{ultimaAtividadeEm}', to_jsonb(${AGORA - INATIVIDADE_MAXIMA_MS}::bigint))::json`;
                assert.equal(await registrarAtividade('teste', sessao), false);
            }, { timeout: 10000, maxWait: 3000 });
        } finally { prisma.$executeRaw = original; }
    });
