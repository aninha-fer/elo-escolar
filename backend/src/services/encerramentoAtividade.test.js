const test = require('node:test');
const assert = require('node:assert/strict');
const { dataEncerramento, fimMatricula, agoraInstituicao } = require('./encerramentoAtividade');
const data = (d) => new Date(`${d}T00:00:00.000Z`);
const hora = (h) => new Date(`1970-01-01T${h}:00.000Z`);

for (const [agora, esperado] of [['08:59', '2026-11-01'], ['09:00', '2026-11-02'], ['09:30', '2026-11-02'], ['18:00', '2026-11-02']]) {
  test(`encerramento às ${agora} preserva somente ocorrências já iniciadas`, () => {
    const fim = dataEncerramento([{ data: data('2026-11-02'), hora: hora('09:00') }], new Date(`2026-11-02T${agora}:00.000Z`));
    assert.equal(fim.toISOString().slice(0, 10), esperado);
  });
}

test('encerramento respeita início futuro e não estende término anterior', () => {
  const m = { data_inicio: data('2026-11-03'), data_fim: null, turma: { horarios: [{ dia_semana: 1, hora_inicio: hora('09:00') }] } };
  const agora = new Date('2026-11-02T15:00:00.000Z');
  assert.deepEqual(fimMatricula(m, agora), data('2026-11-01'));
  assert.deepEqual(fimMatricula({ ...m, data_fim: data('2026-10-30') }, agora), data('2026-10-30'));
});

test('relógio civil usa São Paulo mesmo quando UTC já virou o dia', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-03T01:30:00.000Z') });
  assert.equal(agoraInstituicao().toISOString(), '2026-11-02T22:30:00.000Z');
});
