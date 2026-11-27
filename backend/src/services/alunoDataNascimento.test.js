const test = require('node:test');
const assert = require('node:assert/strict');
const { criarAlunoDTO, editarAlunoDTO } = require('../dtos/alunoDTO');
const { criarAluno, editarAluno } = require('../controllers/alunoController');
const prisma = require('../prismaClient');

const cadastro = { nome: 'Aluno Teste', turno: 'MANHA', dias_frequencia: [1] };
const validar = (data_nascimento) => [
  criarAlunoDTO.safeParse({ ...cadastro, data_nascimento }),
  editarAlunoDTO.safeParse({ data_nascimento })
];

test('cadastro e edição aceitam somente datas válidas anteriores ao dia atual da instituição', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-25T15:00:00.000Z') });
  for (const valor of ['2026-11-24', '2000-02-29', '1980-01-01']) {
    for (const resultado of validar(valor)) assert.equal(resultado.success, true, valor);
  }
  for (const valor of ['2026-11-25', '2026-11-26', '2030-01-01']) {
    for (const resultado of validar(valor)) {
      assert.equal(resultado.success, false, valor);
      assert.ok(resultado.error.issues.some((item) => item.path[0] === 'data_nascimento'
        && item.message === 'A data de nascimento deve ser anterior a hoje.'));
    }
  }
  for (const valor of ['2026-02-30', '2025-02-29', '2026-13-01', '25/11/2000', 'inválida']) {
    for (const resultado of validar(valor)) assert.equal(resultado.success, false, valor);
  }
});

test('a data continua opcional no cadastro e pode ser removida na edição', () => {
  for (const valor of [undefined, null, '']) assert.equal(criarAlunoDTO.safeParse({ ...cadastro, data_nascimento: valor }).success, true);
  assert.equal(editarAlunoDTO.safeParse({ nome: 'Aluno Teste' }).success, true);
  assert.equal(editarAlunoDTO.safeParse({ data_nascimento: null }).success, true);
});

test('a validação acompanha a meia-noite de São Paulo mesmo quando UTC já mudou de dia', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2027-01-01T02:59:59.999Z') });
  for (const resultado of validar('2026-12-30')) assert.equal(resultado.success, true);
  for (const resultado of validar('2026-12-31')) assert.equal(resultado.success, false);
  t.mock.timers.tick(1);
  for (const resultado of validar('2026-12-31')) assert.equal(resultado.success, true);
  for (const resultado of validar('2027-01-01')) assert.equal(resultado.success, false);
});

test('API rejeita hoje e futuro antes de gravar, tanto no cadastro quanto na edição', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-25T15:00:00.000Z') });
  const original = prisma.$transaction;
  t.after(() => { prisma.$transaction = original; });
  prisma.$transaction = t.mock.fn(async () => { throw new Error('Não deve gravar datas inválidas.'); });
  for (const data_nascimento of ['2026-11-25', '2026-11-26']) {
    for (const status of ['RASCUNHO', 'ATIVO']) {
      for (const controller of [criarAluno, editarAluno]) {
        const res = { status(codigo) { this.statusCode = codigo; return this; }, json(body) { this.body = body; return this; } };
        await controller({ params: { id: '1' }, body: { ...cadastro, status, data_nascimento } }, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.erros.some((item) => item.path[0] === 'data_nascimento'));
      }
    }
  }
  assert.equal(prisma.$transaction.mock.callCount(), 0);
});
