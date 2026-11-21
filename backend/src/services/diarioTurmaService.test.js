const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { obterDiarioTurmaService } = require('./turmaService');
const { diarioTurmaQueryDTO } = require('../dtos/turmaDTO');

const data = valor => new Date(`${valor}T00:00:00Z`);
function turma() {
    return { nome: 'Girassol', tipo: 'REGULAR', status: 'ATIVO',
        ano_letivo: { ano: 2026, data_inicio: data('2026-02-15'), data_fim: data('2026-12-18') },
        matriculas: Array.from({ length: 27 }, (_, id) => ({ aluno: { id: id + 1, pessoa: { nome: `Aluno ${String(id + 1).padStart(2, '0')}` }, dias_frequencia: [5, 1, 3] } })) };
}
function simular(t, registro = turma(), agora = '2026-11-21T15:00:00Z') {
    t.mock.timers.enable({ apis: ['Date'], now: new Date(agora) });
    const original = prisma.turma.findUnique;
    t.after(() => { prisma.turma.findUnique = original; });
    let consulta;
    prisma.turma.findUnique = async entrada => { consulta = entrada; return registro; };
    return () => consulta;
}

test('diário retorna todos os alunos ativos, mesmo além de vinte, sem dados pessoais adicionais', async t => {
    const consulta = simular(t);
    const diario = await obterDiarioTurmaService(1, 11);
    assert.deepEqual(Object.keys(diario), ['nome', 'calendario', 'alunos']);
    assert.equal(diario.alunos.length, 27);
    assert.deepEqual(diario.alunos[0], { nome: 'Aluno 01', dias_frequencia: [1, 3, 5] });
    assert.equal(consulta().where.deleted_at, null);
    assert.deepEqual(consulta().select.matriculas.where, { status: 'ATIVO', aluno: { deleted_at: null } });
    assert.equal(consulta().select.matriculas.take, undefined);
    assert.deepEqual(consulta().select.matriculas.select.aluno.select.pessoa, { select: { nome: true } });
});

test('mesmo aluno com mais de uma matrícula ativa aparece uma única vez', async t => {
    const registro = turma(); registro.matriculas.push(registro.matriculas[0]);
    simular(t, registro);
    assert.equal((await obterDiarioTurmaService(1, 11)).alunos.length, 27);
});

for (const mudanca of [{ tipo: 'OFICINA' }, { status: 'INATIVO' }, { ano_letivo: null }]) {
    test(`diário bloqueia turma indisponível ${JSON.stringify(mudanca)}`, async t => {
        simular(t, { ...turma(), ...mudanca });
        await assert.rejects(obterDiarioTurmaService(1, 11), { statusCode: 409 });
    });
}

test('turma inexistente ou excluída retorna 404', async t => {
    simular(t, null);
    await assert.rejects(obterDiarioTurmaService(99, 11), { statusCode: 404 });
});

test('meses passados são recusados, mas o mês atual permite seus dias anteriores', async t => {
    simular(t);
    await assert.rejects(obterDiarioTurmaService(1, 10), { statusCode: 400 });
    assert.equal((await obterDiarioTurmaService(1, 11)).alunos.length, 27);
    assert.ok(await obterDiarioTurmaService(1, 12));
});

test('ano do calendário determina quais meses são futuros e meses fora dele são recusados', async t => {
    const registro = turma(); registro.ano_letivo = { ano: 2027, data_inicio: data('2027-02-15'), data_fim: data('2027-12-18') };
    simular(t, registro);
    assert.ok(await obterDiarioTurmaService(1, 2));
    await assert.rejects(obterDiarioTurmaService(1, 1), { statusCode: 400 });
});

test('intervalo letivo contendo somente fim de semana não permite diário', async t => {
    const registro = turma(); registro.ano_letivo = { ano: 2027, data_inicio: data('2027-02-20'), data_fim: data('2027-02-21') };
    simular(t, registro);
    await assert.rejects(obterDiarioTurmaService(1, 2), { statusCode: 400 });
});

test('comparação do mês considera Brasília na virada do ano', async t => {
    const registro = turma(); registro.ano_letivo.data_fim = data('2026-12-31');
    simular(t, registro, '2027-01-01T01:00:00Z');
    assert.ok(await obterDiarioTurmaService(1, 12));
});

test('turma sem alunos pode exportar cabeçalhos vazios', async t => {
    simular(t, { ...turma(), matriculas: [] });
    assert.deepEqual((await obterDiarioTurmaService(1, 11)).alunos, []);
});

test('DTO exige mês inteiro entre um e doze e não aceita seleção de ano', () => {
    assert.equal(diarioTurmaQueryDTO.parse({ mes: '2' }).mes, 2);
    for (const entrada of [{}, { mes: '0' }, { mes: '13' }, { mes: '1.5' }, { mes: 'abc' }, { mes: '2', ano: '2027' }]) assert.throws(() => diarioTurmaQueryDTO.parse(entrada));
});

test('rota de diário permite administrador e professor, exige autenticação e valida a entrada', async t => {
    simular(t);
    const express = require('express');
    const { turmaLeituraRoutes } = require('../routes/turmaRoutes');
    const app = express();
    app.use((req, res, next) => { if (req.get('x-test-role')) req.usuario = { role: req.get('x-test-role') }; next(); });
    app.use('/api', turmaLeituraRoutes);
    const servidor = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    t.after(() => new Promise(resolve => servidor.close(resolve)));
    const url = `http://127.0.0.1:${servidor.address().port}/api/turmas/1/diario`;
    for (const [role, status] of [['admin', 200], ['professor', 200], [null, 401], ['outro', 403]]) {
        assert.equal((await fetch(`${url}?mes=11`, { headers: role ? { 'x-test-role': role } : {} })).status, status);
    }
    assert.equal((await fetch(`${url}?mes=0`, { headers: { 'x-test-role': 'professor' } })).status, 400);
    assert.equal((await fetch(url, { headers: { 'x-test-role': 'professor' } })).status, 400);
});
