import test from 'node:test';
import assert from 'node:assert/strict';
import { sortearAlunosTurma } from './sorteioTurma.js';

const alunos = [1, 2, 3, 4, 5].map((id) => ({ id }));

test('sorteio preenche vagas sem repetir e mantém os bloqueados inclusive fora da busca', () => {
    const selecionados = sortearAlunosTurma(alunos, [5, 2], 4, () => 0);
    assert.equal(selecionados.length, 4);
    assert.equal(new Set(selecionados).size, 4);
    assert.ok(selecionados.includes(5));
    assert.ok(selecionados.includes(2));
    assert.deepEqual(alunos.map((a) => a.id), [1, 2, 3, 4, 5]);
});

test('novo sorteio pode substituir todos os selecionados não bloqueados', () => {
    const primeiro = sortearAlunosTurma(alunos, [1], 3, () => 0);
    const segundo = sortearAlunosTurma(alunos, [1], 3, () => 0.99);
    assert.notDeepEqual(primeiro, segundo);
    assert.equal(primeiro[0], 1);
    assert.equal(segundo[0], 1);
});

test('falta de candidatos não duplica alunos para completar vagas', () => {
    assert.deepEqual(new Set(sortearAlunosTurma(alunos, [1], 10)), new Set([1, 2, 3, 4, 5]));
    assert.deepEqual(sortearAlunosTurma([], [], 3), []);
});

test('vagas menores que os bloqueados não removem silenciosamente bloqueios', () => {
    assert.equal(sortearAlunosTurma(alunos, [1, 2], 1), null);
    assert.equal(sortearAlunosTurma(alunos, [], -1), null);
    assert.equal(sortearAlunosTurma(alunos, [], 1.5), null);
    assert.deepEqual(sortearAlunosTurma(alunos, [], 0), []);
});

test('sorteio descarta bloqueios inelegíveis e duplicados', () => {
    const ids = sortearAlunosTurma(alunos, [1, 1, 99], 2, () => 0);
    assert.equal(ids.length, 2);
    assert.ok(ids.includes(1));
    assert.equal(ids.includes(99), false);
});
