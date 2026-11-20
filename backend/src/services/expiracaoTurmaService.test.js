const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { turmaExpirada, comExpiracao } = require('./calendarioLetivo');
const { sincronizarTurmasExpiradas } = require('./encerramentoTurmaService');
const { fimMatricula } = require('./encerramentoAtividade');

const data = (dia) => new Date(`${dia}T00:00:00Z`);
const calendario = { data_inicio: data('2026-02-03'), data_fim: data('2026-12-19') };

for (const [instante, expirada] of [
    ['2026-12-19T03:00:00Z', false],
    ['2026-12-20T02:59:59Z', false],
    ['2026-12-20T03:00:00Z', true],
    ['2027-01-10T15:00:00Z', true],
]) {
    test(`expiração usa o dia civil de Brasília em ${instante}`, (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: new Date(instante) });
        for (const status of ['ATIVO', 'INATIVO']) {
            assert.equal(turmaExpirada({ tipo: 'REGULAR', status, ano_letivo: calendario }), expirada);
            assert.equal(comExpiracao({ tipo: 'REGULAR', status, ano_letivo: calendario }).expirada, expirada);
        }
        assert.equal(turmaExpirada({ tipo: 'OFICINA', ano_letivo: calendario }), false);
        assert.equal(turmaExpirada({ tipo: 'REGULAR', ano_letivo: { ...calendario, data_fim: data('2028-12-19') } }), false);
    });
}

test('nenhuma candidata exige só identificação por filtro, sem transação ou matrículas', async (t) => {
    const consultar = prisma.turma.findMany, transacionar = prisma.$transaction;
    t.after(() => { prisma.turma.findMany = consultar; prisma.$transaction = transacionar; });
    prisma.turma.findMany = t.mock.fn(async () => []);
    prisma.$transaction = t.mock.fn(() => { throw new Error('Transação desnecessária'); });
    await sincronizarTurmasExpiradas();
    assert.equal(prisma.$transaction.mock.callCount(), 0);
    const consulta = prisma.turma.findMany.mock.calls[0].arguments[0];
    assert.deepEqual(consulta.select, { id: true });
    assert.equal(consulta.where.tipo, 'REGULAR');
    assert.equal(consulta.where.status, 'ATIVO');
    assert.equal(consulta.where.deleted_at, null);
    assert.ok(consulta.where.ano_letivo.data_fim.lt instanceof Date);
    await sincronizarTurmasExpiradas({ alunoIds: [] });
    assert.equal(prisma.turma.findMany.mock.callCount(), 1);
});

test('encerramento tardio limita vigência e preserva início futuro e término anterior', () => {
    const matricula = { data_inicio: data('2027-01-10'), data_fim: null, turma: { horarios: [] } };
    assert.deepEqual(fimMatricula(matricula, new Date('2027-01-20T12:00:00Z'), calendario.data_fim), data('2026-12-19'));
    assert.deepEqual(matricula.data_inicio, data('2027-01-10'));
    assert.deepEqual(fimMatricula({ ...matricula, data_fim: data('2026-11-01') }, new Date('2027-01-20T12:00:00Z'), calendario.data_fim), data('2026-11-01'));
});
