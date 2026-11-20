const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
test.beforeEach((t) => {
    const original = prisma.turma.findMany;
    prisma.turma.findMany = t.mock.fn(async () => []);
    t.after(() => { prisma.turma.findMany = original; });
});
const { editarTurma } = require('../controllers/turmaController');
const { obterTurmaService } = require('./turmaService');
const hora = (valor) => new Date(`1970-01-01T${valor}:00.000Z`);

function simular(t, opcoes = {}) {
    let estado = {
        turma: { id: 10, nome: 'Turma A', tipo: opcoes.tipo ?? 'REGULAR', turno: 'MANHA', ano_letivo_id: 2026,
            ambiente_id: 2, capacidade_maxima: 10, descricao: null, profissional_id: 1, status: 'ATIVO' },
        horarios: (opcoes.tipo === 'OFICINA' ? [2, 4] : [1, 2, 3, 4, 5]).map((dia_semana) => ({
            id: dia_semana, turma_id: 10, dia_semana,
            hora_inicio: hora(opcoes.tipo === 'OFICINA' ? '08:15' : dia_semana === 3 ? '12:30' : '07:30'),
            hora_fim: hora(opcoes.tipo === 'OFICINA' ? '09:15' : dia_semana === 3 ? '16:30' : '11:30'),
        })),
        matriculas: [], ...opcoes.estado,
    };
    const chamadas = [];
    const original = prisma.$transaction;
    t.after(() => { prisma.$transaction = original; });
    prisma.$transaction = t.mock.fn(async (callback, options) => {
        assert.equal(options.isolationLevel, 'ReadCommitted');
        const pendente = structuredClone(estado);
        const resultado = await callback({
            $queryRaw: async (sql, id) => { if (sql.join('?').includes('pg_advisory')) return [];  if (sql.join('?').includes('FROM "funcionario"')) assert.ok(Number.isInteger(id)); else assert.equal(id, 10); assert.ok(sql.join('?').includes('FOR UPDATE')); chamadas.push('bloqueio'); },
            ano_letivo: { findUnique: async ({where}) => ({id: where.id, ano: where.id, data_inicio: new Date('2027-02-08T00:00:00Z'), data_fim: new Date('2099-12-18T00:00:00Z')}) },
            turma: {
                findUnique: async ({ where }) => { assert.equal(chamadas[0], 'bloqueio'); assert.deepEqual(where, { id: 10 });
                    return pendente.turma ? { ...pendente.turma, horarios: pendente.horarios } : null; },
                update: async ({ data }) => { chamadas.push('turma'); Object.assign(pendente.turma, data); },
            },
            matricula_turma: {
                findMany: async () => pendente.matriculas.map((status, indice) => ({ id: indice + 1, aluno_id: 10, turma_id: 10,
                    status, data_inicio: null, data_fim: pendente.encerramentos?.[indice] ?? opcoes.fimProvisorio ?? null }))
                    .filter((m) => m.status === 'ATIVO' || m.data_fim === null),
                update: async ({ where, data }) => {
                    pendente.encerramentos ??= {};
                    pendente.encerramentos[where.id - 1] = data.data_fim;
                    if (data.status) pendente.matriculas[where.id - 1] = data.status;
                },
                groupBy: async ({ where, by }) => {
                assert.deepEqual(where, { turma_id: 10 }); assert.deepEqual(by, ['status', 'data_fim']);
                return [...new Set(pendente.matriculas)].map((status) => ({ status, data_fim: opcoes.fimProvisorio ?? null, _count: { _all: pendente.matriculas.filter((item) => item === status).length } }));
            } },
            ambiente: { findUnique: async () => opcoes.salaInexistente ? null : { id: 2 } },
            funcionario: { findUnique: async () => opcoes.profissionalInexistente ? null : {
                cargo: opcoes.cargo ?? 'Professor', pessoa: { status_geral: opcoes.statusProfissional ?? 'ATIVO' },
            } },
            turma_horario: {
                deleteMany: async ({ where }) => { assert.deepEqual(where, { turma_id: 10 }); chamadas.push('remover-horarios'); pendente.horarios = []; },
                createMany: async ({ data }) => {
                    chamadas.push('criar-horarios');
                    if (opcoes.falhaHorarios) throw new Error('Falha simulada ao gravar horários');
                    pendente.horarios = data.map((h, indice) => ({ id: indice + 20, ...h }));
                },
            },
        });
        estado = pendente;
        return resultado;
    });
    return { get estado() { return estado; }, chamadas };
}

async function editar(body, id = '10') {
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await editarTurma({ params: { id }, body }, res);
    return res;
}

test('regular sem matrículas atualiza turno, ano e os cinco horários persistidos', async (t) => {
    const banco = simular(t);
    const res = await editar({ ambiente_id: 2, turno: 'TARDE', ano_letivo_id: 2027 });
    assert.equal(res.code, 200);
    assert.equal(banco.estado.turma.ano_letivo_id, 2027);
    assert.equal(banco.estado.horarios.length, 5);
    for (const h of banco.estado.horarios) {
        assert.equal(h.turma_id, 10); assert.equal(h.hora_inicio.toISOString().slice(11, 16), '12:30');
        assert.equal(h.hora_fim.toISOString().slice(11, 16), '16:30');
    }
    assert.deepEqual(banco.chamadas, ['bloqueio', 'turma', 'remover-horarios', 'criar-horarios']);
    assert.equal((await editar({ ambiente_id: 2, turno: 'MANHA' })).code, 200);
    assert.equal(banco.estado.horarios.find((h) => h.dia_semana === 3).hora_inicio.toISOString().slice(11, 16), '12:30');
    assert.equal(banco.estado.horarios.find((h) => h.dia_semana === 1).hora_inicio.toISOString().slice(11, 16), '07:30');
});

test('oficina sem matrículas substitui horários e dias, sem duplicar registros', async (t) => {
    const banco = simular(t, { tipo: 'OFICINA' });
    const res = await editar({ ambiente_id: 2, turno: 'TARDE', hora_inicio: '13:30', hora_fim: '14:45', dias_semana: [5, 1, 5] });
    assert.equal(res.code, 200);
    assert.deepEqual(banco.estado.horarios.map((h) => h.dia_semana), [1, 5]);
    for (const h of banco.estado.horarios) assert.equal(h.hora_inicio.toISOString().slice(11, 16), '13:30');
    assert.equal(banco.estado.turma.turno, 'TARDE');
});

for (const tipo of ['REGULAR', 'OFICINA']) {
    for (const status of ['ATIVO', 'PROVISORIO', 'INATIVO']) {
        test(`${tipo} com vínculo ${status} bloqueia alterações de agenda e permite campos comuns`, async (t) => {
            const banco = simular(t, { tipo, estado: { matriculas: [status] } });
            const horarios = structuredClone(banco.estado.horarios);
            const alteracoes = tipo === 'REGULAR' ? [{ turno: 'TARDE' }, { ano_letivo_id: 2027 }]
                : [{ turno: 'TARDE' }, { hora_inicio: '09:45' }, { hora_fim: '11:00' }, { dias_semana: [1] }];
            for (const agenda of alteracoes) assert.equal((await editar({ ...agenda, ambiente_id: 2, nome: 'Não deve gravar' })).code, 409);
            assert.equal(banco.estado.turma.nome, 'Turma A');
            assert.equal((await editar({ ambiente_id: 2, nome: 'Novo nome', descricao: 'Descrição', capacidade_maxima: 12, profissional_id: 2 })).code, 200);
            assert.deepEqual(banco.estado.horarios, horarios);
        });
    }
}

for (const tipo of ['REGULAR', 'OFICINA']) {
    test(`${tipo}: inativação exige confirmação quando há matrículas ativas e provisórias`, async (t) => {
        const banco = simular(t, { tipo, estado: { matriculas: ['ATIVO', 'PROVISORIO'] } });
        assert.equal((await editar({ status: 'INATIVO', ambiente_id: 2, nome: 'Não deve gravar' })).code, 409);
        assert.equal(banco.estado.turma.status, 'ATIVO'); assert.equal(banco.estado.turma.nome, 'Turma A');
    });
    test(`${tipo}: inativação confirmada encerra provisórios mantendo o status`, async (t) => {
        const banco = simular(t, { tipo, estado: { matriculas: ['PROVISORIO', 'PROVISORIO'] } });
        assert.equal((await editar({ status: 'INATIVO' })).code, 409);
        assert.equal((await editar({ status: 'INATIVO', confirmar_cancelamentos: { matriculas: [1, 2], matriculas_ativas: 0 } })).code, 200);
        assert.equal(banco.estado.turma.status, 'INATIVO');
        assert.deepEqual(banco.estado.matriculas, ['PROVISORIO', 'PROVISORIO']);
        assert.ok(Object.values(banco.estado.encerramentos).every((fim) => fim instanceof Date));
    });
}

test('histórico inativo permite inativar, editar campos comuns e reativar', async (t) => {
    const banco = simular(t, { estado: { matriculas: ['INATIVO'] } });
    assert.equal((await editar({ status: 'INATIVO' })).code, 200);
    assert.equal((await editar({ ambiente_id: 2, nome: 'Turma inativa editada' })).code, 200);
    assert.equal(banco.estado.turma.status, 'INATIVO');
    assert.equal((await editar({ status: 'ATIVO' })).code, 200);
    assert.equal(banco.estado.turma.status, 'ATIVO');
});

test('capacidade não pode ficar abaixo da ocupação ativa, provisórios não ocupam vagas', async (t) => {
    simular(t, { estado: { matriculas: ['ATIVO', 'ATIVO', 'PROVISORIO', 'INATIVO'] } });
    assert.equal((await editar({ ambiente_id: 2, capacidade_maxima: 1 })).code, 409);
    assert.equal((await editar({ ambiente_id: 2, capacidade_maxima: 2 })).code, 200);
    assert.equal((await editar({ ambiente_id: 2, capacidade_maxima: null })).code, 200);
});

test('falha ao criar horários desfaz a alteração da turma e preserva os horários anteriores', async (t) => {
    const banco = simular(t, { falhaHorarios: true });
    t.mock.method(console, 'error', () => {});
    assert.equal((await editar({ ambiente_id: 2, turno: 'TARDE' })).code, 500);
    assert.equal(banco.estado.turma.turno, 'MANHA');
    assert.equal(banco.estado.horarios.length, 5);
    assert.equal(banco.estado.horarios[0].hora_inicio.toISOString().slice(11, 16), '07:30');
});

test('DTO rejeita sala nula, alterações de tipo, dias inválidos e corpos vazios', async (t) => {
    simular(t);
    for (const body of [{}, { ambiente_id: null }, { tipo: 'OFICINA', ambiente_id: 2 },
        { dias_semana: [6], ambiente_id: 2 }, { capacidade_maxima: -1, ambiente_id: 2 }, { status: 'PROVISORIO' }]) {
        assert.equal((await editar(body)).code, 400);
    }
    assert.equal((await editar({ status: 'ATIVO' }, 'abc')).code, 400);
    assert.equal(prisma.$transaction.mock.callCount(), 0);
});

for (const tipo of ['REGULAR', 'OFICINA']) {
    test(`${tipo}: PATCH somente com nome preserva a sala cadastrada`, async (t) => {
        const banco = simular(t, { tipo });
        const res = await editar({ nome: 'Novo nome' });
        assert.equal(res.code, 200);
        assert.equal(banco.estado.turma.nome, 'Novo nome');
        assert.equal(banco.estado.turma.ambiente_id, 2);
    });
}

test('alteração de cronograma sem enviar sala utiliza o ambiente já cadastrado', async (t) => {
    const banco = simular(t);
    assert.equal((await editar({ turno: 'TARDE' })).code, 200);
    assert.equal(banco.estado.turma.ambiente_id, 2);
    assert.ok(banco.estado.horarios.every((h) => h.hora_inicio.toISOString().slice(11, 16) === '12:30'));
});

test('horários fora das faixas e campos específicos do tipo errado são recusados', async (t) => {
    simular(t, { tipo: 'OFICINA' });
    assert.equal((await editar({ ambiente_id: 2, hora_inicio: '10:00' })).code, 400);
    assert.equal((await editar({ ambiente_id: 2, ano_letivo_id: 2027 })).code, 400);
});

for (const [opcoes, body, esperado] of [
    [{ salaInexistente: true }, { ambiente_id: 99 }, 404],
    [{ profissionalInexistente: true }, { ambiente_id: 2, profissional_id: 9 }, 404],
    [{ cargo: 'Terapeuta' }, { ambiente_id: 2, profissional_id: 9 }, 400],
    [{ statusProfissional: 'INATIVO' }, { ambiente_id: 2, profissional_id: 9 }, 400],
    [{ estado: { turma: null } }, { status: 'ATIVO' }, 404],
]) {
    test(`edição valida vínculos e existência: ${JSON.stringify(opcoes)}`, async (t) => {
        simular(t, opcoes);
        assert.equal((await editar(body)).code, esperado);
    });
}

test('detalhe sinaliza histórico mesmo sem alunos com matrícula ativa', async (t) => {
    const buscarMatriculas = prisma.matricula_turma.findMany;
    t.after(() => { prisma.matricula_turma.findMany = buscarMatriculas; });
    prisma.matricula_turma.findMany = async () => [];
    const original = prisma.turma.findUnique;
    t.after(() => { prisma.turma.findUnique = original; });
    prisma.turma.findUnique = async ({ select }) => {
        assert.deepEqual(select._count, { select: { matriculas: true } });
        return { id: 10, horarios: [], matriculas: [], _count: { matriculas: 1 } };
    };
    assert.deepEqual(await obterTurmaService(10), { id: 10, horarios: [], expirada: false, alunos: [], possui_matriculas: true,
        matriculas_ativas: 0, confirmacao_cancelamentos: { matriculas: [], matriculas_ativas: 0 } });
});

test('provisório encerrado permite inativação, mas ainda constitui histórico da turma', async (t) => {
    simular(t, { fimProvisorio: new Date('2026-11-01T00:00:00.000Z'), estado: { matriculas: ['PROVISORIO'] } });
    assert.equal((await editar({ status: 'INATIVO' })).code, 200);
    assert.equal((await editar({ ambiente_id: 2, turno: 'TARDE' })).code, 409);
});

test('rota PATCH permite somente administração', async (t) => {
    const express = require('express');
    const { createServer } = require('node:http');
    const { turmaAdminRoutes } = require('../routes/turmaRoutes');
    simular(t);
    const app = express(); app.use(express.json());
    app.use('/api', (req, res, next) => { if (req.get('x-test-role')) req.usuario = { role: req.get('x-test-role') }; next(); }, turmaAdminRoutes);
    const server = createServer(app);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    for (const [role, status] of [[null, 401], ['professor', 403], ['admin', 200]]) {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/api/turmas/10`, { method: 'PATCH',
            headers: { 'content-type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, body: JSON.stringify({ status: 'INATIVO' }) });
        assert.equal(res.status, status);
    }
});
