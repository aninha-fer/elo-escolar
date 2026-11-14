const test = require('node:test');
const assert = require('node:assert/strict');
const argon2 = require('argon2');
const prisma = require('../prismaClient');
const { verificarCredenciais, buscarIdentidadePorId } = require('./authService');
const { requireAuth } = require('../middlewares/requireAuth');

function simular(t, usuario, senhaCorreta = true) {
    const original = prisma.usuario.findUnique;
    t.after(() => { prisma.usuario.findUnique = original; });
    prisma.usuario.findUnique = t.mock.fn(async ({ select }) => {
        assert.equal(select.status, true);
        assert.equal(select.pessoa.select.status_geral, true);
        return usuario;
    });
    t.mock.method(argon2, 'hash', async () => 'hash-ficticio');
    t.mock.method(argon2, 'verify', async () => senhaCorreta);
}

const ativo = { id: 1, email: 'conta@example.com', role: 'admin', status: 'ATIVO', senha_hash: 'hash-de-teste',
    pessoa: { nome: 'Maria', status_geral: 'ATIVO' } };

for (const [descricao, usuario, permitido] of [
    ['usuário e pessoa ativos', ativo, true],
    ['usuário inativo e pessoa ativa', { ...ativo, status: 'INATIVO' }, false],
    ['usuário ativo e pessoa inativa', { ...ativo, pessoa: { ...ativo.pessoa, status_geral: 'INATIVO' } }, false],
    ['usuário inexistente', null, false],
]) {
    test(`autenticação e identidade respeitam ${descricao}`, async (t) => {
        simular(t, usuario);
        const identidade = permitido ? { id: 1, email: ativo.email, role: 'admin', nome: 'Maria' } : null;
        assert.deepEqual(await verificarCredenciais({ email: ativo.email, senha: 'senha-de-teste' }), identidade);
        assert.deepEqual(await buscarIdentidadePorId(1), identidade);
    });
}

test('usuário ativo continua bloqueado com senha incorreta', async (t) => {
    simular(t, ativo, false);
    assert.equal(await verificarCredenciais({ email: ativo.email, senha: 'senha-incorreta' }), null);
});

test('inativação invalida a sessão na próxima requisição e reativação permite novo login', async (t) => {
    const usuario = { ...ativo };
    simular(t, usuario);
    let destruicoes = 0, acessos = 0;
    const req = { session: { usuarioId: 1, autenticadoEm: Date.now(), destroy(callback) { destruicoes++; callback(); } } };
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; },
        clearCookie(nome, options) { this.cookie = { nome, options }; } };
    await requireAuth(req, res, () => acessos++);
    assert.equal(acessos, 1);
    assert.equal(destruicoes, 0);
    usuario.status = 'INATIVO';
    await requireAuth(req, res, () => acessos++);
    assert.equal(acessos, 1);
    assert.equal(destruicoes, 1);
    assert.equal(res.code, 401);
    assert.deepEqual(res.cookie, { nome: 'elo.sid', options: { path: '/api' } });
    usuario.status = 'ATIVO';
    assert.equal((await verificarCredenciais({ email: ativo.email, senha: 'senha-de-teste' })).id, 1);
});
