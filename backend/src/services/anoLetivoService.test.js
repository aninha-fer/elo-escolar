const test = require('node:test');
const assert = require('node:assert/strict');
const { validarDatas } = require('./anoLetivoService');
const { inicioMatriculaRegular, diaLetivo, hojeInstituicao } = require('./calendarioLetivo');
const { criarAnoLetivoDTO, editarAnoLetivoDTO } = require('../dtos/anoLetivoDTO');

const data = (valor) => new Date(`${valor}T00:00:00Z`);
const calendario = { id: 1, ano: 2027, data_inicio: data('2027-02-08'), data_fim: data('2027-12-18') };

for (const [hoje, mudancas, permitido] of [
  ['2027-02-07', { data_inicio: '2027-02-09' }, true],
  ['2027-02-07', { data_inicio: '2027-02-07' }, false],
  ['2027-02-08', { data_inicio: '2027-02-09' }, false],
  ['2027-06-01', { data_inicio: '2027-06-02' }, false],
  ['2027-12-18', { data_fim: '2027-12-19' }, true],
  ['2027-12-18', { data_fim: '2027-12-17' }, false],
  ['2027-12-19', { data_fim: '2027-12-20' }, false],
  ['2027-12-19', { data_inicio: '2028-02-01' }, false],
  ['2027-12-19', { ano: 2028, data_inicio: '2027-02-08', data_fim: '2027-12-18' }, true],
  ['2027-02-07', { data_fim: '2027-02-01' }, false],
]) {
  test(`edição em ${hoje}: ${JSON.stringify(mudancas)} ${permitido ? 'permitida' : 'bloqueada'}`, () => {
    const acao = () => validarDatas(mudancas, calendario, false, data(hoje));
    if (permitido) assert.doesNotThrow(acao);
    else assert.throws(acao);
  });
}

test('ano fica bloqueado com qualquer turma vinculada, mas valor inalterado é aceito', () => {
  assert.throws(() => validarDatas({ ano: 2028 }, calendario, true, data('2027-02-07')));
  assert.doesNotThrow(() => validarDatas({ ano: 2027 }, calendario, true, data('2027-02-07')));
});

test('calendários usam datas reais, rejeitam campos desconhecidos e update vazio', () => {
  assert.equal(criarAnoLetivoDTO.safeParse({ ano: 2027, data_inicio: '2027-02-30', data_fim: '2027-12-18' }).success, false);
  assert.equal(criarAnoLetivoDTO.safeParse({ ano: 2027, data_inicio: '2027-02-08', data_fim: '2027-12-18' }).success, true);
  assert.equal(editarAnoLetivoDTO.safeParse({}).success, false);
  assert.equal(editarAnoLetivoDTO.safeParse({ status: 'ATIVO' }).success, false);
});

test('matrícula regular usa o maior início sem permitir calendário ausente ou encerrado', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2027-02-01T12:00:00Z') });
  const turma = { nome: 'Regular', ano_letivo: calendario };
  assert.deepEqual(inicioMatriculaRegular(turma), data('2027-02-08'));
  assert.deepEqual(inicioMatriculaRegular(turma, data('2027-02-15')), data('2027-02-15'));
  assert.throws(() => inicioMatriculaRegular(turma, data('2028-01-01')));
  assert.throws(() => inicioMatriculaRegular({ nome: 'Sem calendário' }));
  t.mock.timers.setTime(new Date('2027-12-18T20:00:00Z').getTime());
  assert.deepEqual(inicioMatriculaRegular(turma), data('2027-12-18'));
  t.mock.timers.setTime(new Date('2027-12-19T12:00:00Z').getTime());
  assert.throws(() => inicioMatriculaRegular(turma));
});

test('comparações respeitam o dia de Brasília na virada UTC', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2027-02-08T02:30:00Z') });
  assert.deepEqual(hojeInstituicao(), data('2027-02-07'));
});

test('união de calendários tem limites inclusivos, férias e sobreposições', () => {
  assert.equal(diaLetivo([], data('2027-02-08')), false);
  assert.equal(diaLetivo([calendario], data('2027-02-08')), true);
  assert.equal(diaLetivo([calendario], data('2027-12-18')), true);
  assert.equal(diaLetivo([calendario], data('2027-12-19')), false);
  assert.equal(diaLetivo([calendario, calendario], data('2027-06-01')), true);
});
