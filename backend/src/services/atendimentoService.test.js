const test = require('node:test');
const assert = require('node:assert/strict');
const { gerarDatasSessoes, obterDatasRecorrentes } = require('./atendimentoService');

function datasDaRecorrencia(dados) {
  return obterDatasRecorrentes(dados).map((data) => data.toISOString().slice(0, 10));
}

test('gera sessões semanais nos dias selecionados a cada intervalo de semanas', () => {
  assert.deepEqual(datasDaRecorrencia({
    tipo_recorrencia: 'SEMANAL',
    data_inicio: '2026-10-26',
    data_termino: '2026-11-15',
    frequencia: 2,
    dias_semana: [1, 3]
  }), ['2026-10-26', '2026-10-28', '2026-11-09', '2026-11-11']);
});

test('gera exatamente uma sessão para um atendimento eventual', () => {
  assert.deepEqual(gerarDatasSessoes({
    tipo_recorrencia: 'EVENTUAL',
    data_inicio: '2026-10-26'
  }).map((data) => data.toISOString().slice(0, 10)), ['2026-10-26']);
});

test('mantém o dia mensal e usa o último dia em meses mais curtos', () => {
  assert.deepEqual(datasDaRecorrencia({
    tipo_recorrencia: 'MENSAL',
    data_inicio: '2026-01-31',
    data_termino: '2026-03-31',
    frequencia: 1
  }), ['2026-01-31', '2026-02-28', '2026-03-31']);
});

test('inclui a data de término quando coincide com uma sessão semanal', () => {
  assert.deepEqual(datasDaRecorrencia({
    tipo_recorrencia: 'SEMANAL',
    data_inicio: '2026-10-26',
    data_termino: '2026-10-26',
    frequencia: 1,
    dias_semana: [1]
  }), ['2026-10-26']);
});

test('rejeita uma recorrência semanal sem sessões no período', () => {
  assert.throws(() => obterDatasRecorrentes({
    tipo_recorrencia: 'SEMANAL',
    data_inicio: '2026-10-26',
    data_termino: '2026-10-26',
    frequencia: 1,
    dias_semana: [2]
  }), /Não há sessões dentro do período informado/);
});
