const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { criarProfissionalService } = require('./profissionalService');
const { criarProfissional, listarProfissionais, editarProfissional } = require('../controllers/profissionalController');

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
        assert.equal(query.select.pessoa_id, true);
        assert.deepEqual(query.select.pessoa.select, { nome: true, telefone: true, status_geral: true });
        return [
            { id: 7, pessoa_id: 50, cargo: 'Professor', pessoa: { nome: 'Maria', telefone: null, status_geral: 'ATIVO' } },
            { id: 8, pessoa_id: 51, cargo: 'Auxiliar', pessoa: { nome: 'Paulo', telefone: null, status_geral: 'INATIVO' } },
        ];
    };
    const res = resposta();
    await listarProfissionais({}, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, [
        { id: 7, pessoa_id: 50, nome: 'Maria', telefone: null, funcao: 'Professor', status_geral: 'ATIVO' },
        { id: 8, pessoa_id: 51, nome: 'Paulo', telefone: null, funcao: 'Auxiliar', status_geral: 'INATIVO' },
    ]);
});

test('listagem oficial responde 200 mesmo sem profissionais cadastrados', async (t) => {
    const original = prisma.funcionario.findMany;
    t.after(() => { prisma.funcionario.findMany = original; });
    prisma.funcionario.findMany = async () => [];
    const res = resposta();
    await listarProfissionais({}, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, []);
});

test('falha na listagem oficial retorna mensagem pública sem detalhes internos', async (t) => {
    const original = prisma.funcionario.findMany;
    t.after(() => { prisma.funcionario.findMany = original; });
    prisma.funcionario.findMany = async () => { throw new Error('Detalhe interno de conexão'); };
    t.mock.method(console, 'error', () => {});
    const res = resposta();
    await listarProfissionais({}, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { erro: 'Erro interno ao listar profissionais.' });
});

test('rota oficial lista profissionais com permissão e a rota temporária foi removida', async (t) => {
    const express = require('express');
    const { createServer } = require('node:http');
    const profissionalRoutes = require('../routes/profissionalRoutes');
    const atendimentosRoutes = require('../routes/atendimentosRoutes');
    const original = prisma.funcionario.findMany;
    t.after(() => { prisma.funcionario.findMany = original; });
    prisma.funcionario.findMany = async () => [
        { id: 7, pessoa_id: 50, cargo: 'Terapeuta', pessoa: { nome: 'Ana', telefone: null, status_geral: 'ATIVO' } },
    ];
    const app = express();
    app.use('/api', (req, res, next) => {
        req.usuario = { role: req.get('x-test-role') || 'admin' };
        next();
    }, profissionalRoutes, atendimentosRoutes);
    const server = createServer(app);
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

    const oficial = await fetch(`${baseUrl}/profissionais`);
    assert.equal(oficial.status, 200);
    assert.deepEqual(await oficial.json(), [
        { id: 7, pessoa_id: 50, nome: 'Ana', telefone: null, funcao: 'Terapeuta', status_geral: 'ATIVO' },
    ]);
    const semPermissao = await fetch(`${baseUrl}/profissionais`, { headers: { 'x-test-role': 'professor' } });
    assert.equal(semPermissao.status, 403);
    const temporaria = await fetch(`${baseUrl}/atendimentos/profissionais`);
    assert.equal(temporaria.status, 404);
});

function simularEdicao(t, inicial = {}) {
    let estado = {
        profissional: { id: 7, pessoa_id: 50, cargo: 'Professor' },
        pessoa: { id: 50, nome: 'Maria', telefone: '51999999999', status_geral: 'ATIVO' },
        usuarios: [{ id: 3, pessoa_id: 50, status: 'ATIVO' }],
        turmas: [], atendimentos: [], ...inicial,
    };
    const chamadas = [];
    const original = prisma.$transaction;
    t.after(() => { prisma.$transaction = original; });
    prisma.$transaction = t.mock.fn(async (callback, options) => {
        assert.equal(options.isolationLevel, 'ReadCommitted');
        const pendente = structuredClone(estado);
        const resultado = await callback({
            $queryRaw: async (sql, id) => { assert.equal(id, 7); assert.ok(sql.join('?').includes('FOR UPDATE')); chamadas.push('bloqueio'); },
            funcionario: {
                findUnique: async ({ where }) => {
                    assert.deepEqual(where, { id: 7 });
                    return pendente.profissional ? { ...pendente.profissional, pessoa: pendente.pessoa } : null;
                },
                update: async ({ data }) => { chamadas.push('cargo'); Object.assign(pendente.profissional, data); },
            },
            pessoa: { update: async ({ where, data }) => {
                assert.deepEqual(where, { id: 50 }); chamadas.push('pessoa'); Object.assign(pendente.pessoa, data);
            } },
            turma: { findMany: async ({ where }) => {
                assert.deepEqual(where, { profissional_id: 7 }); chamadas.push('turmas'); return pendente.turmas;
            } },
            atendimento_clinico: { findMany: async ({ where }) => {
                assert.deepEqual(where, { profissional_id: 7 }); chamadas.push('atendimentos'); return pendente.atendimentos;
            } },
            usuario: { updateMany: async ({ where, data }) => {
                assert.deepEqual(where, { pessoa_id: 50 }); chamadas.push('usuario');
                if (inicial.falhaUsuario) throw new Error('Falha simulada na conta');
                for (const usuario of pendente.usuarios) Object.assign(usuario, data);
                return { count: pendente.usuarios.length };
            } },
        });
        estado = pendente;
        return resultado;
    });
    return { get estado() { return estado; }, chamadas };
}

async function editar(body, id = '7') {
    const res = resposta();
    await editarProfissional({ params: { id }, body }, res);
    return res;
}

test('edição altera nome, telefone e cargo atomicamente sem alterar status da conta', async (t) => {
    const banco = simularEdicao(t, { usuarios: [{ id: 3, pessoa_id: 50, status: 'INATIVO' }] });
    const res = await editar({ nome: ' Maria Silva ', telefone: '5133334444', cargo: ' Auxiliar ' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { id: 7, pessoa_id: 50, nome: 'Maria Silva', telefone: '5133334444', funcao: 'Auxiliar', status_geral: 'ATIVO' });
    assert.equal(banco.estado.usuarios[0].status, 'INATIVO');
    assert.equal(banco.chamadas.includes('usuario'), false);
});

test('PATCH parcial preserva campos omitidos e permite limpar telefone explicitamente', async (t) => {
    const banco = simularEdicao(t);
    assert.equal((await editar({ nome: 'Maria Silva' })).statusCode, 200);
    assert.equal(banco.estado.pessoa.telefone, '51999999999');
    for (const telefone of [null, '']) {
        const res = await editar({ telefone });
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.telefone, null);
        assert.equal(res.body.nome, 'Maria Silva');
    }
});

for (const status_geral of ['ATIVO', 'INATIVO']) {
    test(`status ${status_geral} é sincronizado com conta vinculada na mesma transação`, async (t) => {
        const banco = simularEdicao(t, { pessoa: { id: 50, nome: 'Maria', telefone: null, status_geral: status_geral === 'ATIVO' ? 'INATIVO' : 'ATIVO' } });
        const res = await editar({ status_geral });
        assert.equal(res.statusCode, 200);
        assert.equal(banco.estado.pessoa.status_geral, status_geral);
        assert.equal(banco.estado.usuarios[0].status, status_geral);
        assert.equal(banco.estado.profissional.cargo, 'Professor');
        assert.equal(res.body.pessoa_id, 50);
    });
}

test('sem conta vinculada, alteração de status não cria usuário', async (t) => {
    const banco = simularEdicao(t, { usuarios: [] });
    assert.equal((await editar({ status_geral: 'INATIVO' })).statusCode, 200);
    assert.equal((await editar({ status_geral: 'ATIVO' })).statusCode, 200);
    assert.deepEqual(banco.estado.usuarios, []);
});

for (const inicial of [
    { turmas: [{ id: 10, nome: 'Turma A', status: 'ATIVO' }] },
    { turmas: [{ id: 11, nome: 'Turma histórica', status: 'INATIVO' }] },
    { atendimentos: [{ id: 20, modalidade: 'Psicologia', status: 'ATIVO' }] },
    { atendimentos: [{ id: 21, modalidade: 'Fisioterapia', status: 'PROVISORIO' }] },
    { atendimentos: [{ id: 22, modalidade: 'Histórico', status: 'INATIVO' }] },
]) {
    test(`vínculo ${JSON.stringify(inicial)} impede inativação sem alterações parciais`, async (t) => {
        const banco = simularEdicao(t, inicial);
        const res = await editar({ nome: 'Não deve gravar', status_geral: 'INATIVO' });
        assert.equal(res.statusCode, 409);
        assert.ok(res.body.conflitos[0].mensagem);
        assert.equal(banco.estado.pessoa.nome, 'Maria');
        assert.equal(banco.estado.pessoa.status_geral, 'ATIVO');
        assert.equal(banco.estado.usuarios[0].status, 'ATIVO');
        assert.equal(banco.chamadas.includes('pessoa'), false);
        assert.equal(banco.chamadas.includes('usuario'), false);
    });
}

test('profissional inativo aceita somente ativação, sem edição simultânea', async (t) => {
    const banco = simularEdicao(t, { pessoa: { id: 50, nome: 'Maria', telefone: null, status_geral: 'INATIVO' } });
    for (const body of [{ nome: 'Maria Silva' }, { status_geral: 'ATIVO', cargo: 'Auxiliar' }]) {
        assert.equal((await editar(body)).statusCode, 409);
    }
    assert.equal(banco.estado.pessoa.status_geral, 'INATIVO');
    assert.equal((await editar({ status_geral: 'ATIVO' })).statusCode, 200);
});

test('falha na sincronização da conta desfaz alteração de pessoa e cargo', async (t) => {
    const banco = simularEdicao(t, { falhaUsuario: true });
    t.mock.method(console, 'error', () => {});
    const res = await editar({ status_geral: 'INATIVO', cargo: 'Auxiliar', nome: 'Outro nome' });
    assert.equal(res.statusCode, 500);
    assert.equal(banco.estado.pessoa.nome, 'Maria');
    assert.equal(banco.estado.pessoa.status_geral, 'ATIVO');
    assert.equal(banco.estado.profissional.cargo, 'Professor');
    assert.equal(banco.estado.usuarios[0].status, 'ATIVO');
    assert.deepEqual(res.body, { erro: 'Erro interno ao editar profissional.' });
});

test('profissional inexistente retorna 404', async (t) => {
    simularEdicao(t, { profissional: null });
    assert.equal((await editar({ nome: 'Maria Silva' })).statusCode, 404);
});

test('DTO rejeita campos inválidos, corpo vazio e IDs inválidos antes de iniciar transação', async (t) => {
    simularEdicao(t);
    for (const body of [{}, { nome: ' ' }, { telefone: '123' }, { telefone: false }, { cargo: '' }, { status_geral: 'PROVISORIO' },
        { email: 'conta@example.com' }, { pessoa_id: 99 }]) assert.equal((await editar(body)).statusCode, 400);
    for (const id of ['0', '-1', 'abc', '1.5', '2147483648']) assert.equal((await editar({ nome: 'Maria Silva' }, id)).statusCode, 400);
    assert.equal(prisma.$transaction.mock.callCount(), 0);
});

test('PATCH exige administração e recebe ID do funcionário, não a matrícula da pessoa', async (t) => {
    const express = require('express');
    const { createServer } = require('node:http');
    const routes = require('../routes/profissionalRoutes');
    simularEdicao(t);
    const app = express();
    app.use(express.json());
    app.use('/api', (req, res, next) => { if (req.get('x-test-role')) req.usuario = { role: req.get('x-test-role') }; next(); }, routes);
    const server = createServer(app);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    for (const [role, status] of [[null, 401], ['professor', 403], ['admin', 200]]) {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/api/profissionais/7`, { method: 'PATCH',
            headers: { 'content-type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, body: JSON.stringify({ nome: 'Maria Silva' }) });
        assert.equal(res.status, status);
        if (status === 200) assert.equal((await res.json()).pessoa_id, 50);
    }
    assert.equal(prisma.$transaction.mock.callCount(), 1);
});
