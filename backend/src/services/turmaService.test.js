const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
test.beforeEach((t) => {
    const original = prisma.turma.findMany;
    prisma.turma.findMany = t.mock.fn(async () => []);
    t.after(() => { prisma.turma.findMany = original; });
});
const { criarTurmaService, obterTurmaService } = require('./turmaService');
const { criarTurma, obterTurma } = require('../controllers/turmaController');
const { listarTurmasQueryDTO } = require('../dtos/turmaDTO');

test('filtros opcionais da Home validam status e ano sem exigir alterações nos consumidores anteriores', () => {
    assert.deepEqual(listarTurmasQueryDTO.parse({ tipo: 'OFICINA' }), { tipo: 'OFICINA' });
    assert.deepEqual(listarTurmasQueryDTO.parse({ tipo: 'REGULAR', status: 'ATIVO', ano: '2026' }), { tipo: 'REGULAR', status: 'ATIVO', ano: 2026 });
    for (const dados of [{ status: 'RASCUNHO' }, { ano: 'abc' }, { ano: '0' }, { ano: '2026.5' }, { ano: '10000' }]) assert.equal(listarTurmasQueryDTO.safeParse(dados).success, false);
});

const regular = { tipo: 'REGULAR', nome: ' Turma A ', turno: 'MANHA', profissionais_ids: [1], ambiente_id: 2, ano_letivo_id: 2026 };
const oficina = { tipo: 'OFICINA', nome: 'Artes', turno: 'MANHA', profissionais_ids: [1], ambiente_id: 2,
    hora_inicio: '08:15', hora_fim: '09:15', dias_semana: [2, 4] };

function simularTransacao(t, { cargo = 'Professor', profissionalExiste = true, salaExiste = true, falhaHorarios } = {}) {
    let pendente;
    let horarios;
    const vinculos = [];
    const estado = { confirmado: null, gravacoes: 0 };
    const original = prisma.$transaction;
    t.after(() => { prisma.$transaction = original; });
    prisma.$transaction = t.mock.fn(async (callback, options) => {
        assert.equal(options.isolationLevel, 'ReadCommitted');
        const resultado = await callback({
            $queryRaw: async () => [],
            ano_letivo: { findUnique: async ({where}) => ({id: where.id, ano: where.id, data_inicio: new Date('2026-02-03T00:00:00Z'), data_fim: new Date('2099-12-19T00:00:00Z')}) },
            funcionario: { findUnique: async () => profissionalExiste ? { cargo, pessoa: { status_geral: 'ATIVO' } } : null },
            ambiente: { findUnique: async () => salaExiste ? { id: 2 } : null },
            turma: {
                create: async ({ data }) => { estado.gravacoes++; pendente = { id: 10, ...data }; return pendente; },
                findUnique: async () => ({ ...pendente, horarios, profissionais: vinculos })
            },
            turma_profissional: { createMany: async ({ data }) => { vinculos.push(...data.map((v, i) => ({ ...v, id: i + 1, data_fim: null,
                profissional: { id: v.profissional_id, cargo, pessoa: { nome: 'Professor teste', status_geral: 'ATIVO' } } }))); } },
            turma_horario: { createMany: async ({ data }) => {
                if (falhaHorarios) throw falhaHorarios;
                horarios = data;
                return { count: data.length };
            } }
        });
        estado.confirmado = resultado;
        return resultado;
    });
    return estado;
}

for (const turno of ['MANHA', 'TARDE']) {
    test(`regular ${turno} persiste cinco dias com horários fixos e um profissional`, async (t) => {
        simularTransacao(t, { cargo: 'Auxiliar' });
        const turma = await criarTurmaService({ ...regular, turno, hora_inicio: '00:00', dias_semana: [7], capacidade_maxima: 0 });
        assert.equal(turma.nome, 'Turma A');
        assert.deepEqual(turma.profissionais.map((p) => p.id), [1]);
        assert.equal(turma.ambiente_id, 2);
        assert.equal(turma.capacidade_maxima, 0);
        assert.equal(turma.descricao, null);
        assert.deepEqual(turma.horarios.map((h) => [h.dia_semana, h.hora_inicio.toISOString(), h.hora_fim.toISOString()]),
            [1, 2, 3, 4, 5].map((dia) => {
                const manha = turno === 'MANHA' && dia !== 3;
                return [dia, `1970-01-01T${manha ? '07:30' : '12:30'}:00.000Z`, `1970-01-01T${manha ? '11:30' : '16:30'}:00.000Z`];
            }));
    });
}

for (const [turno, inicio, fim] of [['MANHA', '08:15', '09:15'], ['MANHA', '09:45', '11:00'],
    ['TARDE', '13:30', '14:45'], ['TARDE', '15:15', '16:30']]) {
    test(`oficina aceita ${inicio}–${fim}, sem ano letivo, e elimina dias duplicados`, async (t) => {
        simularTransacao(t, { cargo: 'Professor' });
        const turma = await criarTurmaService({ ...oficina, turno, hora_inicio: inicio, hora_fim: fim,
            dias_semana: [4, 2, 4], ambiente_id: 2, descricao: ' Oficina semanal ' });
        assert.equal(turma.ano_letivo_id, null);
        assert.equal(turma.ambiente_id, 2);
        assert.equal(turma.descricao, 'Oficina semanal');
        assert.deepEqual(turma.horarios.map((h) => h.dia_semana), [2, 4]);
        for (const horario of turma.horarios) {
            assert.equal(horario.turma_id, turma.id);
            assert.equal(horario.hora_inicio.toISOString().slice(11, 16), inicio);
            assert.equal(horario.hora_fim.toISOString().slice(11, 16), fim);
        }
    });
}

test('entradas inválidas são recusadas antes da transação', async (t) => {
    const original = prisma.$transaction;
    t.after(() => { prisma.$transaction = original; });
    prisma.$transaction = () => assert.fail('Não deve iniciar transação.');
    for (const dados of [
        { ...regular, ano_letivo_id: undefined }, { ...regular, nome: ' ' }, { ...regular, tipo: 'INVALIDO' },
        { ...regular, turno: 'NOITE' }, { ...regular, profissionais_ids: 1 },
        { ...regular, capacidade_maxima: -1 }, { ...regular, capacidade_maxima: 1.5 },
        { ...regular, ano_letivo_id: 2026.5 }, { ...regular, ambiente_id: 0 }, { ...regular, ambiente_id: undefined }, { ...regular, ambiente_id: null },
        { ...oficina, dias_semana: [] }, { ...oficina, dias_semana: [0] }, { ...oficina, dias_semana: [8] },
        { ...oficina, dias_semana: [1.5] }, { ...oficina, hora_inicio: undefined },
        { ...oficina, hora_fim: '11:00' }, { ...oficina, turno: 'TARDE' }
    ]) await assert.rejects(criarTurmaService(dados), { name: 'ZodError' });
});

for (const cargo of ['Professor', 'Auxiliar']) {
    test(`oficina aceita ${cargo} como responsável no cadastro`, async (t) => {
        simularTransacao(t, { cargo });
        assert.deepEqual((await criarTurmaService(oficina)).profissionais.map((p) => p.id), oficina.profissionais_ids);
    });
}

for (const [tipo, cargo] of [['REGULAR', 'Cargo inválido'], ['OFICINA', 'Clínico'], ['REGULAR', 'Clínico'], ['OFICINA', 'Outro'], ['REGULAR', 'Outro']]) {
    test(`${tipo} recusa cargo ${cargo} antes de gravar`, async (t) => {
        const estado = simularTransacao(t, { cargo });
        await assert.rejects(criarTurmaService(tipo === 'REGULAR' ? regular : oficina), { statusCode: 400 });
        assert.equal(estado.gravacoes, 0);
    });
}

test('profissional inexistente retorna 404 sem criar turma', async (t) => {
    const estado = simularTransacao(t, { profissionalExiste: false });
    await assert.rejects(criarTurmaService(regular), { statusCode: 404 });
    assert.equal(estado.gravacoes, 0);
});

test('sala informada precisa existir', async (t) => {
    const estado = simularTransacao(t, { salaExiste: false });
    await assert.rejects(criarTurmaService({ ...regular, ambiente_id: 2 }), { statusCode: 404 });
    assert.equal(estado.gravacoes, 0);
});

test('falha nos horários é propagada e impede confirmação da operação', async (t) => {
    const falha = new Error('Falha simulada');
    const estado = simularTransacao(t, { falhaHorarios: falha });
    await assert.rejects(criarTurmaService(regular), (error) => error === falha);
    assert.equal(estado.confirmado, null);
});

function resposta() {
    return { status(codigo) { this.statusCode = codigo; return this; }, json(body) { this.body = body; return this; } };
}

function simularConsultaTurma(t, consultar) {
    const buscarMatriculas = prisma.matricula_turma.findMany;
    t.after(() => { prisma.matricula_turma.findMany = buscarMatriculas; });
    prisma.matricula_turma.findMany = async () => [];
    const original = prisma.turma.findUnique;
    t.after(() => { prisma.turma.findUnique = original; });
    prisma.turma.findUnique = t.mock.fn(consultar);
    return prisma.turma.findUnique;
}

for (const tipo of ['REGULAR', 'OFICINA']) {
    test(`detalhe de ${tipo} consulta horários e somente matrículas ativas com dados pessoais limitados`, async (t) => {
        const horario = { id: 1, dia_semana: 2, hora_inicio: new Date('1970-01-01T08:15:00.000Z'), hora_fim: new Date('1970-01-01T09:15:00.000Z') };
        const aluno = { id: 5, dias_frequencia: [2], pessoa: { nome: 'Ana' } };
        const dados = { id: 10, nome: 'Turma A', tipo, capacidade_maxima: 12, turno: 'MANHA',
            ambiente_id: 1, ambiente: { id: 1, nome: 'Sala A' }, descricao: 'Descrição', ano_letivo_id: 2026,
            status: 'ATIVO', created_at: new Date('2026-01-01T00:00:00.000Z'), horarios: [horario] };
        simularConsultaTurma(t, async ({ where, select }) => {
            assert.deepEqual(where, { id: 10, deleted_at: null });
            assert.equal(select.matriculas.where.status, 'ATIVO');
            assert.deepEqual(select.matriculas.where.aluno, { deleted_at: null });
            assert.deepEqual(select.matriculas.where.OR.map((f) => Object.keys(f)), [['data_fim'], ['data_fim']]);
            assert.equal(select.matriculas.where.OR[0].data_fim, null);
            assert.ok(select.matriculas.where.OR[1].data_fim.gte instanceof Date);
            assert.deepEqual(select.matriculas.orderBy, [{ aluno: { pessoa: { nome: 'asc' } } }, { aluno_id: 'asc' }, { id: 'asc' }]);
            assert.deepEqual(select.matriculas.select, { aluno: { select: {
                id: true, dias_frequencia: true, pessoa: { select: { nome: true } }
            } } });
            assert.deepEqual(select.horarios.orderBy, [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }, { id: 'asc' }]);
            assert.equal(select.profissionais.select.profissional.select.pessoa.select.nome, true);
            assert.deepEqual(select.ambiente, { select: { id: true, nome: true } });
            return { ...dados, profissionais: [{ id: 1, profissional_id: 2, data_inicio: null, data_fim: null, profissional: { id: 2, cargo: 'Professor', pessoa: { nome: 'Maria', status_geral: 'ATIVO' } } }], matriculas: [{ aluno }] };
        });
        const profissional = { id: 2, cargo: 'Professor', pessoa: { nome: 'Maria' }, status_geral: 'ATIVO', excluido: false };
        assert.deepEqual(await obterTurmaService(10), { ...dados, profissionais: [profissional], historico_profissionais: [{ id: 1, profissional, data_inicio: null, data_fim: null }], expirada: false, possui_matriculas: true, alunos: [aluno],
            matriculas_ativas: 0, confirmacao_cancelamentos: { matriculas: [], matriculas_ativas: 0 } });
    });
}

test('detalhe preserva turma sem matrículas e sem horários, com opcionais nulos', async (t) => {
    simularConsultaTurma(t, async () => ({ id: 1, status: 'INATIVO', ambiente: null, descricao: null,
        ano_letivo_id: null, capacidade_maxima: null, horarios: [], matriculas: [] }));
    const turma = await obterTurmaService(1);
    assert.deepEqual(turma.alunos, []);
    assert.deepEqual(turma.horarios, []);
    assert.equal(turma.ambiente, null);
    assert.equal(turma.status, 'INATIVO');
    assert.equal('matriculas' in turma, false);
});

test('detalhe sem alunos não carrega a lista inteira e mantém a contagem de matrículas ativas', async (t) => {
    const consultar = simularConsultaTurma(t, async ({ select }) => {
        assert.equal(select.matriculas, undefined);
        return { id: 1, horarios: [], _count: { matriculas: 50 } };
    });
    const original = prisma.matricula_turma.count;
    t.after(() => { prisma.matricula_turma.count = original; });
    prisma.matricula_turma.count = async () => 45;
    const turma = await obterTurmaService(1, false);
    assert.equal(consultar.mock.callCount(), 1);
    assert.deepEqual(turma.alunos, []);
    assert.equal(turma.matriculas_ativas, 45);
    assert.equal(turma.possui_matriculas, true);
    assert.equal(turma.confirmacao_cancelamentos, undefined);
});

test('turma inexistente retorna null no service e 404 no controller', async (t) => {
    simularConsultaTurma(t, async () => null);
    assert.equal(await obterTurmaService(1), null);
    const res = resposta();
    await obterTurma({ params: { id: '1' } }, res);
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { erro: 'Turma não encontrada.' });
});

test('controller valida ID antes de consultar e responde 400 para valores inválidos', async (t) => {
    const consultar = simularConsultaTurma(t, () => assert.fail('Não deve consultar com ID inválido.'));
    for (const id of ['abc', '', ' ', '0', '-1', '1.5', 'Infinity', '2147483648', '9007199254740993', undefined]) {
        const res = resposta();
        await obterTurma({ params: { id } }, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.erros.length);
    }
    assert.equal(consultar.mock.callCount(), 0);
});

test('controller responde 200 convertendo o ID da URL para número', async (t) => {
    simularConsultaTurma(t, async ({ where }) => {
        assert.deepEqual(where, { id: 12, deleted_at: null });
        return { id: 12, horarios: [], matriculas: [] };
    });
    const res = resposta();
    await obterTurma({ params: { id: '12' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { id: 12, horarios: [], profissionais: [], historico_profissionais: [], expirada: false, possui_matriculas: false, alunos: [], matriculas_ativas: 0, confirmacao_cancelamentos: { matriculas: [], matriculas_ativas: 0 } });
});

test('erro do banco retorna 500 sem expor detalhes internos', async (t) => {
    simularConsultaTurma(t, async () => { throw new Error('Detalhes privados do banco'); });
    t.mock.method(console, 'error', () => {});
    const res = resposta();
    await obterTurma({ params: { id: '1' } }, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { erro: 'Erro interno ao obter turma.' });
});

test('GET /api/turmas/:id respeita permissão de leitura e não captura /turmas/regulares', async (t) => {
    const express = require('express');
    const { createServer } = require('node:http');
    const { turmaLeituraRoutes } = require('../routes/turmaRoutes');
    const consultar = simularConsultaTurma(t, async () => ({ id: 1, horarios: [], matriculas: [] }));
    const original = prisma.turma.findMany;
    t.after(() => { prisma.turma.findMany = original; });
    prisma.turma.findMany = async () => [];
    const app = express();
    app.use('/api', (req, res, next) => {
        if (req.get('x-test-role')) req.usuario = { role: req.get('x-test-role') };
        next();
    }, turmaLeituraRoutes);
    const server = createServer(app);
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}/api/turmas`;
    for (const [role, codigo] of [[null, 401], ['outro', 403], ['professor', 200], ['admin', 200]]) {
        const response = await fetch(`${base}/1`, { headers: role ? { 'x-test-role': role } : {} });
        assert.equal(response.status, codigo);
        if (codigo === 200) assert.deepEqual(await response.json(), { id: 1, horarios: [], profissionais: [], historico_profissionais: [], expirada: false, possui_matriculas: false, alunos: [], matriculas_ativas: 0, confirmacao_cancelamentos: { matriculas: [], matriculas_ativas: 0 } });
    }
    assert.equal(consultar.mock.callCount(), 2);
    const regulares = await fetch(`${base}/regulares`, { headers: { 'x-test-role': 'professor' } });
    assert.equal(regulares.status, 200);
    assert.deepEqual(await regulares.json(), []);
    assert.equal(consultar.mock.callCount(), 2);
});

test('controller retorna 201 com turma e horários', async (t) => {
    simularTransacao(t);
    const res = resposta();
    await criarTurma({ body: regular }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.horarios.length, 5);
});

test('controller diferencia validação, vínculo inexistente e falha interna', async (t) => {
    const res = resposta();
    await criarTurma({ body: { ...regular, ano_letivo_id: undefined } }, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.erros.length);
    simularTransacao(t, { profissionalExiste: false });
    await criarTurma({ body: regular }, res);
    assert.equal(res.statusCode, 404);
    prisma.$transaction.mock.mockImplementation(async () => { throw new Error('Detalhes privados'); });
    t.mock.method(console, 'error', () => {});
    await criarTurma({ body: regular }, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { erro: 'Erro interno ao cadastrar turma.' });
});

test('POST /api/turmas permite administrador e bloqueia professor e usuário sem sessão', async (t) => {
    const express = require('express');
    const { createServer } = require('node:http');
    const { turmaAdminRoutes } = require('../routes/turmaRoutes');
    const estado = simularTransacao(t);
    const app = express();
    app.use(express.json());
    app.use('/api', (req, res, next) => {
        if (req.get('x-test-role')) req.usuario = { role: req.get('x-test-role') };
        next();
    }, require('../middlewares/exigirPermissao').exigirPermissao('administracao:acessar'), turmaAdminRoutes);
    const server = createServer(app);
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}/api/turmas`;
    for (const [role, status] of [[null, 401], ['professor', 403], ['admin', 201]]) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(role ? { 'x-test-role': role } : {}) },
            body: JSON.stringify(regular)
        });
        assert.equal(response.status, status);
        if (status !== 201) assert.equal(estado.gravacoes, 0);
        else assert.equal((await response.json()).horarios.length, 5);
    }
});
