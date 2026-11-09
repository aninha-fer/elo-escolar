const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { criarTurmaService } = require('./turmaService');
const { criarTurma } = require('../controllers/turmaController');

const regular = { tipo: 'REGULAR', nome: ' Turma A ', turno: 'MANHA', profissional_id: 1, ano_letivo: 2026 };
const oficina = { tipo: 'OFICINA', nome: 'Artes', turno: 'MANHA', profissional_id: 1,
    hora_inicio: '08:15', hora_fim: '09:15', dias_semana: [2, 4] };

function simularTransacao(t, { cargo = 'Professor', profissionalExiste = true, salaExiste = true, falhaHorarios } = {}) {
    let pendente;
    let horarios;
    const estado = { confirmado: null, gravacoes: 0 };
    const original = prisma.$transaction;
    t.after(() => { prisma.$transaction = original; });
    prisma.$transaction = t.mock.fn(async (callback, options) => {
        assert.equal(options.isolationLevel, 'ReadCommitted');
        const resultado = await callback({
            funcionario: { findUnique: async () => profissionalExiste ? { cargo } : null },
            ambiente: { findUnique: async () => salaExiste ? { id: 2 } : null },
            turma: {
                create: async ({ data }) => { estado.gravacoes++; pendente = { id: 10, ...data }; return pendente; },
                findUnique: async () => ({ ...pendente, horarios })
            },
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
        assert.equal(turma.profissional_id, 1);
        assert.equal(turma.ambiente_id, null);
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
        simularTransacao(t, { cargo: 'Oficineiro' });
        const turma = await criarTurmaService({ ...oficina, turno, hora_inicio: inicio, hora_fim: fim,
            dias_semana: [4, 2, 4], ambiente_id: 2, descricao: ' Oficina semanal ' });
        assert.equal(turma.ano_letivo, null);
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
        { ...regular, ano_letivo: undefined }, { ...regular, nome: ' ' }, { ...regular, tipo: 'INVALIDO' },
        { ...regular, turno: 'NOITE' }, { ...regular, profissional_id: [1, 2] },
        { ...regular, capacidade_maxima: -1 }, { ...regular, capacidade_maxima: 1.5 },
        { ...regular, ano_letivo: 2026.5 }, { ...regular, ambiente_id: 0 },
        { ...oficina, dias_semana: [] }, { ...oficina, dias_semana: [0] }, { ...oficina, dias_semana: [8] },
        { ...oficina, dias_semana: [1.5] }, { ...oficina, hora_inicio: undefined },
        { ...oficina, hora_fim: '11:00' }, { ...oficina, turno: 'TARDE' }
    ]) await assert.rejects(criarTurmaService(dados), { name: 'ZodError' });
});

for (const [tipo, cargo] of [['REGULAR', 'Oficineiro'], ['OFICINA', 'Auxiliar'], ['REGULAR', 'Terapeuta']]) {
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

test('controller retorna 201 com turma e horários', async (t) => {
    simularTransacao(t);
    const res = resposta();
    await criarTurma({ body: regular }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.horarios.length, 5);
});

test('controller diferencia validação, vínculo inexistente e falha interna', async (t) => {
    const res = resposta();
    await criarTurma({ body: { ...regular, ano_letivo: undefined } }, res);
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
