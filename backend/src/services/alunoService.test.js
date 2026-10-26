const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { obterAtendimentosService } = require('./alunoService');
const { obterAtendimentos } = require('../controllers/alunoController');

const data = (valor) => new Date(`${valor}T00:00:00.000Z`);

function atendimento(alteracoes = {}) {
  return {
    id: 1, aluno_id: 1, status: 'ATIVO', modalidade: 'Psicologia',
    tipo_recorrencia: 'EVENTUAL', data_inicio: data('2026-10-26'),
    hora_inicio: new Date('1970-01-01T08:00:00.000Z'), duracao_minutos: 30,
    data_termino: null, profissional: { pessoa: { nome: 'Ana' } },
    ...alteracoes
  };
}

// Executa os filtros de leitura sobre registros, sem um banco externo.
function corresponde(registro, filtro) {
  return Object.entries(filtro).every(([campo, esperado]) => {
    if (campo === 'OR') return esperado.some((item) => corresponde(registro, item));
    const atual = registro[campo];
    if (esperado === null || typeof esperado !== 'object') return atual === esperado;
    if ('in' in esperado) return esperado.in.includes(atual);
    if ('gte' in esperado) return atual != null && atual >= esperado.gte;
    return atual != null && corresponde(atual, esperado);
  });
}

function simularBanco(t, registros, agora = '2026-10-26T20:30:00.000Z') {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(agora) });
  const original = prisma.atendimento_clinico.findMany;
  t.after(() => { prisma.atendimento_clinico.findMany = original; });
  const consulta = t.mock.fn(async ({ where, orderBy }) =>
    registros.filter((registro) => corresponde(registro, where)).sort((a, b) => {
      for (const ordem of orderBy) {
        const campo = Object.keys(ordem)[0];
        if (a[campo] < b[campo]) return -1;
        if (a[campo] > b[campo]) return 1;
      }
      return 0;
    }));
  prisma.atendimento_clinico.findMany = consulta;
  return consulta;
}

for (const [inicio, visivel] of [
  ['2026-10-25', false], ['2026-10-26', true], ['2026-10-27', true]
]) {
  test(`pontual em ${inicio}: ${visivel ? 'permanece visível' : 'deixa a listagem'}`, async (t) => {
    const registro = atendimento({ data_inicio: data(inicio) });
    simularBanco(t, [registro]);
    assert.deepEqual(await obterAtendimentosService(1), visivel ? [registro] : []);
  });
}

for (const tipo of ['SEMANAL', 'MENSAL']) {
  for (const [termino, visivel] of [
    ['2026-10-25', false], ['2026-10-26', true], ['2026-11-15', true], [null, true]
  ]) {
    test(`${tipo} com término ${termino}: ${visivel ? 'permanece visível' : 'deixa a listagem'}`, async (t) => {
      const registro = atendimento({
        tipo_recorrencia: tipo, data_inicio: data('2026-09-01'),
        data_termino: termino ? data(termino) : null
      });
      simularBanco(t, [registro]);
      assert.deepEqual(await obterAtendimentosService(1), visivel ? [registro] : []);
    });
  }
}

test('exclui atendimentos inativos e os de outro aluno, independentemente da recorrência', async (t) => {
  const registros = ['EVENTUAL', 'SEMANAL', 'MENSAL'].flatMap((tipo_recorrencia, i) => [
    atendimento({ id: i * 2, tipo_recorrencia, status: 'INATIVO' }),
    atendimento({ id: i * 2 + 1, tipo_recorrencia, aluno_id: 2 })
  ]);
  simularBanco(t, registros);
  assert.deepEqual(await obterAtendimentosService(1), []);
});

test('exibe recorrências que ainda não começaram e as que já tiveram a última sessão', async (t) => {
  const registros = [
    atendimento({ tipo_recorrencia: 'MENSAL', data_inicio: data('2026-09-01'), data_termino: data('2026-10-30') }),
    atendimento({ id: 2, tipo_recorrencia: 'SEMANAL', data_inicio: data('2026-11-01'), data_termino: data('2026-12-01') })
  ];
  simularBanco(t, registros);
  assert.deepEqual(await obterAtendimentosService(1), registros);
});

test('pontual usa a data de início mesmo se existir data de término preenchida', async (t) => {
  simularBanco(t, [atendimento({ data_inicio: data('2026-10-25'), data_termino: data('2026-11-10') })]);
  assert.deepEqual(await obterAtendimentosService(1), []);
});

test('mantém atendimentos de hoje quando UTC já está no dia seguinte', async (t) => {
  const registros = [
    atendimento({ data_inicio: data('2026-10-25') }),
    atendimento({ id: 2, tipo_recorrencia: 'SEMANAL', data_inicio: data('2026-09-01'), data_termino: data('2026-10-25') })
  ];
  simularBanco(t, registros, '2026-10-26T02:59:59.999Z');
  assert.deepEqual(await obterAtendimentosService(1), [registros[1], registros[0]]);
});

test('remove pontual e recorrente exatamente na meia-noite seguinte em São Paulo', async (t) => {
  const registros = [
    atendimento({ data_inicio: data('2026-10-25') }),
    atendimento({ id: 2, tipo_recorrencia: 'MENSAL', data_inicio: data('2026-09-01'), data_termino: data('2026-10-25') }),
    atendimento({ id: 3 })
  ];
  simularBanco(t, registros, '2026-10-26T02:59:59.999Z');
  assert.equal((await obterAtendimentosService(1)).length, 3);
  t.mock.timers.tick(1);
  assert.deepEqual(await obterAtendimentosService(1), [registros[2]]);
});

test('preserva os dados do profissional, a ordenação e os registros encerrados', async (t) => {
  const registros = [
    atendimento({ id: 3, data_inicio: data('2026-10-27') }),
    atendimento({ id: 2 }),
    atendimento({ id: 1 }),
    atendimento({ id: 4, hora_inicio: new Date('1970-01-01T07:00:00.000Z') }),
    atendimento({ id: 5, data_inicio: data('2026-10-25') })
  ];
  const originais = structuredClone(registros);
  const consulta = simularBanco(t, registros);
  const resultado = await obterAtendimentosService(1);
  assert.deepEqual(resultado.map((item) => item.id), [4, 1, 2, 3]);
  assert.equal(resultado[0].profissional.pessoa.nome, 'Ana');
  assert.deepEqual(consulta.mock.calls[0].arguments[0].include, {
    profissional: { select: { pessoa: { select: { nome: true } } } }
  });
  assert.deepEqual(registros, originais);
});

test('controller retorna 200 e somente atendimentos vigentes no contrato atual', async (t) => {
  const vigente = atendimento();
  simularBanco(t, [atendimento({ id: 2, data_inicio: data('2026-10-25') }), vigente]);
  const res = {
    status(codigo) { this.statusCode = codigo; return this; },
    json(body) { this.body = body; return this; }
  };
  await obterAtendimentos({ params: { id: '1' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, [vigente]);
});
