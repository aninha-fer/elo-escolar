const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { gerarDatasSessoes, obterDatasRecorrentes, agendarAtendimentoService, listarProfissionaisAtendimentoService } = require('./atendimentoService');
const { criarAtendimento, listarProfissionais } = require('../controllers/atendimentoController');

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

test('mantém o dia mensal e antecipa o último dia de meses curtos quando cair no fim de semana', () => {
  assert.deepEqual(datasDaRecorrencia({
    tipo_recorrencia: 'MENSAL',
    data_inicio: '2026-12-31',
    data_termino: '2027-03-31',
    frequencia: 1
  }), ['2026-12-31', '2027-01-29', '2027-02-26', '2027-03-31']);
});

test('antecipa sábado e domingo para sexta sem alterar o dia de referência dos meses seguintes', () => {
  assert.deepEqual(datasDaRecorrencia({
    tipo_recorrencia: 'MENSAL', data_inicio: '2026-10-30', data_termino: '2027-03-30', frequencia: 1
  }), ['2026-10-30', '2026-11-30', '2026-12-30', '2027-01-29', '2027-02-26', '2027-03-30']);
});

test('preserva fevereiro bissexto e retorna ao dia original em março', () => {
  assert.deepEqual(datasDaRecorrencia({
    tipo_recorrencia: 'MENSAL', data_inicio: '2028-01-31', data_termino: '2028-03-31', frequencia: 1
  }), ['2028-01-31', '2028-02-29', '2028-03-31']);
});

test('mantém o intervalo de meses quando uma ocorrência é antecipada', () => {
  assert.deepEqual(datasDaRecorrencia({
    tipo_recorrencia: 'MENSAL', data_inicio: '2026-10-30', data_termino: '2027-04-30', frequencia: 2
  }), ['2026-10-30', '2026-12-30', '2027-02-26', '2027-04-30']);
});

test('antecipa para o mês anterior e inclui a sexta que coincide com o término', () => {
  assert.deepEqual(datasDaRecorrencia({
    tipo_recorrencia: 'MENSAL', data_inicio: '2027-04-01', data_termino: '2027-04-30', frequencia: 1
  }), ['2027-04-01', '2027-04-30']);
  assert.deepEqual(datasDaRecorrencia({
    tipo_recorrencia: 'MENSAL', data_inicio: '2027-04-01', data_termino: '2027-06-01', frequencia: 1
  }), ['2027-04-01', '2027-04-30', '2027-06-01']);
});

for (const [termino, incluiJaneiro] of [['2027-01-28', false], ['2027-01-29', true]]) {
  test(`aplica o término ${termino} após antecipar a ocorrência de janeiro`, () => {
    assert.deepEqual(datasDaRecorrencia({
      tipo_recorrencia: 'MENSAL', data_inicio: '2026-10-30', data_termino: termino, frequencia: 1
    }), ['2026-10-30', '2026-11-30', '2026-12-30', ...(incluiJaneiro ? ['2027-01-29'] : [])]);
  });
}

for (const inicio of ['2026-10-31', '2026-11-01']) {
  test(`rejeita início mensal no fim de semana: ${inicio}, sem gravar`, async (t) => {
    const { tx } = simularBanco(t);
    const dados = { ...dadosBase, tipo_recorrencia: 'MENSAL', data_inicio: inicio,
      data_termino: '2026-12-31', frequencia: 1 };
    assert.throws(() => obterDatasRecorrentes(dados), {
      statusCode: 400, message: 'A data de início da recorrência mensal deve ser de segunda a sexta-feira.'
    });
    await assert.rejects(() => agendarAtendimentoService(dados), { statusCode: 400 });
    assert.equal(prisma.$transaction.mock.callCount(), 0);
    verificarSemGravacao(tx);
  });
}

for (const inicio of ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']) {
  test(`aceita início mensal em dia útil: ${inicio}`, () => {
    assert.deepEqual(datasDaRecorrencia({
      tipo_recorrencia: 'MENSAL', data_inicio: inicio, data_termino: inicio, frequencia: 1
    }), [inicio]);
  });
}

test('preserva a possibilidade de recorrência semanal aos domingos', () => {
  assert.deepEqual(datasDaRecorrencia({
    tipo_recorrencia: 'SEMANAL', data_inicio: '2026-11-01', data_termino: '2026-11-08',
    frequencia: 1, dias_semana: [7]
  }), ['2026-11-01', '2026-11-08']);
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

const data = (valor) => new Date(`${valor}T00:00:00.000Z`);
const hora = (valor) => new Date(`1970-01-01T${valor}:00.000Z`);
const dadosBase = {
  aluno_id: 1, profissional_id: 2, modalidade: 'Fisioterapia',
  tipo_recorrencia: 'EVENTUAL', data_inicio: '2026-10-26',
  hora_inicio: '09:00', duracao_minutos: 60
};

function sessaoExistente(alteracoes = {}) {
  return {
    id: 10, atendimento_clinico_id: 20, data_sessao: data('2026-10-26'),
    hora_inicio: hora('09:30'), duracao_minutos: 60,
    atendimento_clinico: { modalidade: 'Psicologia' },
    ...alteracoes
  };
}

function oficinaExistente(alteracoes = {}) {
  return {
    id: 30, turma_id: 40, data_inicio: null, data_fim: null,
    turma: {
      nome: 'Música',
      horarios: [{ dia_semana: 1, hora_inicio: hora('09:30'), hora_fim: hora('10:30') }]
    },
    ...alteracoes
  };
}

function simularBanco(t, {
  aluno = { dias_frequencia: [1, 2, 3, 4, 5] }, sessoes = [], matriculas = [],
  agora = '2026-10-26T02:00:00.000Z'
} = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(agora) });
  const eventos = [];
  const tx = {
    $queryRaw: t.mock.fn(async (sql, id) => {
      eventos.push('bloqueio');
      assert.match(sql.join('?'), /SELECT "id" FROM "aluno" WHERE "id" = \? FOR UPDATE/);
      assert.equal(id, dadosBase.aluno_id);
      return [];
    }),
    aluno: { findUnique: t.mock.fn(async () => {
      eventos.push('aluno');
      return aluno ? { status: 'ATIVO', ...aluno } : aluno;
    }) },
    atendimento_sessao: {
      findMany: t.mock.fn(async () => sessoes),
      createMany: t.mock.fn(async () => ({ count: 1 }))
    },
    matricula_turma: { findMany: t.mock.fn(async () => matriculas) },
    atendimento_clinico: {
      create: t.mock.fn(async ({ data: registro }) => ({ id: 99, ...registro })),
      findUnique: t.mock.fn(async () => ({ id: 99, sessoes: [] }))
    }
  };
  const transacaoOriginal = prisma.$transaction;
  t.after(() => { prisma.$transaction = transacaoOriginal; });
  prisma.$transaction = t.mock.fn(async (operacao, opcoes) => {
    assert.equal(opcoes.isolationLevel, 'ReadCommitted');
    return operacao(tx);
  });
  return { tx, eventos };
}

async function verificarConflito(operacao, codigo) {
  let conflito;
  await assert.rejects(operacao, (erro) => {
    assert.equal(erro.isConflict, true);
    conflito = erro.detalhes.find((item) => item.codigo === codigo);
    assert.ok(conflito, `Conflito esperado: ${codigo}`);
    return true;
  });
  return conflito;
}

function verificarSemGravacao(tx) {
  assert.equal(tx.atendimento_clinico.create.mock.callCount(), 0);
  assert.equal(tx.atendimento_sessao.createMany.mock.callCount(), 0);
}

test('cria atendimento e sessões após bloquear o aluno e consultar disponibilidade', async (t) => {
  const { tx, eventos } = simularBanco(t);
  assert.equal((await agendarAtendimentoService(dadosBase)).id, 99);
  assert.deepEqual(eventos, ['bloqueio', 'aluno']);
  assert.equal(tx.atendimento_clinico.create.mock.callCount(), 1);
  assert.deepEqual(tx.atendimento_sessao.createMany.mock.calls[0].arguments[0].data, [{
    atendimento_clinico_id: 99, data_sessao: data('2026-10-26'),
    hora_inicio: hora('09:00'), duracao_minutos: 60, status: 'ATIVO'
  }]);
});

test('retorna 404 quando o aluno não existe, sem gravar', async (t) => {
  const { tx } = simularBanco(t, { aluno: null });
  await assert.rejects(() => agendarAtendimentoService(dadosBase), { statusCode: 404 });
  verificarSemGravacao(tx);
});

test('impede atendimento eventual em dia sem frequência', async (t) => {
  const { tx } = simularBanco(t, { aluno: { dias_frequencia: [2] } });
  const conflito = await verificarConflito(() => agendarAtendimentoService(dadosBase), 'FREQUENCIA_INSUFICIENTE');
  assert.deepEqual(conflito.detalhes, { data: '2026-10-26', dia_semana: 1 });
  verificarSemGravacao(tx);
});

test('impede toda a recorrência semanal se um dos dias não tiver frequência', async (t) => {
  const { tx } = simularBanco(t, { aluno: { dias_frequencia: [1] } });
  const conflito = await verificarConflito(() => agendarAtendimentoService({
    ...dadosBase, tipo_recorrencia: 'SEMANAL', frequencia: 1,
    dias_semana: [1, 3], data_termino: '2026-11-02'
  }), 'FREQUENCIA_INSUFICIENTE');
  assert.equal(conflito.data_sessao, '2026-10-28');
  verificarSemGravacao(tx);
});

test('verifica frequência em cada data mensal, cujo dia da semana varia', async (t) => {
  const { tx } = simularBanco(t, { aluno: { dias_frequencia: [1] } });
  const conflito = await verificarConflito(() => agendarAtendimentoService({
    ...dadosBase, tipo_recorrencia: 'MENSAL', frequencia: 1, data_termino: '2026-11-26'
  }), 'FREQUENCIA_INSUFICIENTE');
  assert.equal(conflito.data_sessao, '2026-11-26');
  verificarSemGravacao(tx);
});

test('grava as datas mensais ajustadas e mantém a configuração original da série', async (t) => {
  const { tx } = simularBanco(t);
  await agendarAtendimentoService({ ...dadosBase, tipo_recorrencia: 'MENSAL', data_inicio: '2026-10-30',
    frequencia: 1, data_termino: '2027-03-30' });
  const configuracao = tx.atendimento_clinico.create.mock.calls[0].arguments[0].data;
  assert.deepEqual(configuracao.data_inicio, data('2026-10-30'));
  assert.deepEqual(configuracao.data_termino, data('2027-03-30'));
  assert.equal(configuracao.frequencia, 1);
  const sessoes = tx.atendimento_sessao.createMany.mock.calls[0].arguments[0].data;
  assert.deepEqual(sessoes.map((item) => item.data_sessao.toISOString().slice(0, 10)),
    ['2026-10-30', '2026-11-30', '2026-12-30', '2027-01-29', '2027-02-26', '2027-03-30']);
  assert.equal(new Set(sessoes.map((item) => item.data_sessao.getTime())).size, sessoes.length);
  assert.ok(sessoes.every((item) => item.data_sessao.getUTCDay() >= 1 && item.data_sessao.getUTCDay() <= 5));
});

test('exige frequência na sexta efetiva da sessão mensal antecipada', async (t) => {
  const { tx } = simularBanco(t, { aluno: { dias_frequencia: [1, 4] } });
  const conflito = await verificarConflito(() => agendarAtendimentoService({ ...dadosBase,
    tipo_recorrencia: 'MENSAL', frequencia: 1, data_termino: '2026-12-26'
  }), 'FREQUENCIA_INSUFICIENTE');
  assert.equal(conflito.data_sessao, '2026-12-25');
  assert.deepEqual(conflito.detalhes, { data: '2026-12-25', dia_semana: 5 });
  verificarSemGravacao(tx);
});

test('detecta conflito clínico na sexta de uma sessão mensal antecipada', async (t) => {
  const { tx } = simularBanco(t, { sessoes: [sessaoExistente({ data_sessao: data('2027-01-29') })] });
  const conflito = await verificarConflito(() => agendarAtendimentoService({ ...dadosBase,
    tipo_recorrencia: 'MENSAL', data_inicio: '2026-10-30', frequencia: 1, data_termino: '2027-01-30'
  }), 'CHOQUE_HORARIO_ATENDIMENTO');
  assert.equal(conflito.data_sessao, '2027-01-29');
  verificarSemGravacao(tx);
});

test('detecta oficina na sexta antecipada, respeitando a vigência da inscrição', async (t) => {
  const { tx } = simularBanco(t, { matriculas: [oficinaExistente({
    data_inicio: data('2027-01-29'), data_fim: data('2027-01-29'),
    turma: { nome: 'Música', horarios: [{ dia_semana: 5, hora_inicio: hora('09:30'), hora_fim: hora('10:30') }] }
  })] });
  const conflito = await verificarConflito(() => agendarAtendimentoService({ ...dadosBase,
    tipo_recorrencia: 'MENSAL', data_inicio: '2026-10-30', frequencia: 1, data_termino: '2027-01-30'
  }), 'CHOQUE_HORARIO_OFICINA');
  assert.equal(conflito.data_sessao, '2027-01-29');
  verificarSemGravacao(tx);
});

test('API responde 400 quando a data inicial mensal cai no fim de semana', async (t) => {
  const { tx } = simularBanco(t);
  const resposta = await chamarController({ ...dadosBase, tipo_recorrencia: 'MENSAL', frequencia: 1,
    data_inicio: '2026-10-31', data_termino: '2026-12-31' });
  assert.equal(resposta.statusCode, 400);
  assert.equal(resposta.body.erro, 'A data de início da recorrência mensal deve ser de segunda a sexta-feira.');
  verificarSemGravacao(tx);
});

test('reconhece domingo como dia 7 e preserva a data UTC', async (t) => {
  simularBanco(t, { aluno: { dias_frequencia: [7] }, agora: '2026-10-25T02:00:00.000Z' });
  await agendarAtendimentoService({ ...dadosBase, data_inicio: '2026-10-25', hora_inicio: '00:15' });
});

for (const [inicio, duracao] of [['08:30', 60], ['09:00', 60], ['09:15', 15], ['08:00', 180]]) {
  test(`impede sobreposição clínica com início ${inicio} e duração ${duracao}`, async (t) => {
    const { tx } = simularBanco(t, { sessoes: [sessaoExistente({ hora_inicio: hora('09:00') })] });
    const conflito = await verificarConflito(() => agendarAtendimentoService({
      ...dadosBase, hora_inicio: inicio, duracao_minutos: duracao
    }), 'CHOQUE_HORARIO_ATENDIMENTO');
    assert.equal(conflito.detalhes.sessao_id, 10);
    assert.equal(conflito.detalhes.modalidade, 'Psicologia');
    verificarSemGravacao(tx);
  });
}

test('impede recorrência quando apenas uma ocorrência posterior conflita', async (t) => {
  const { tx } = simularBanco(t, { sessoes: [sessaoExistente({ data_sessao: data('2026-11-02') })] });
  const conflito = await verificarConflito(() => agendarAtendimentoService({
    ...dadosBase, tipo_recorrencia: 'SEMANAL', frequencia: 1,
    dias_semana: [1], data_termino: '2026-11-09'
  }), 'CHOQUE_HORARIO_ATENDIMENTO');
  assert.equal(conflito.data_sessao, '2026-11-02');
  verificarSemGravacao(tx);
});

test('aceita horários clínicos consecutivos antes e depois', async (t) => {
  simularBanco(t, { sessoes: [
    sessaoExistente({ hora_inicio: hora('08:00'), duracao_minutos: 60 }),
    sessaoExistente({ hora_inicio: hora('10:00'), duracao_minutos: 60 })
  ] });
  await agendarAtendimentoService(dadosBase);
});

test('não confunde mesmo horário em datas diferentes', async (t) => {
  simularBanco(t, { sessoes: [sessaoExistente({ data_sessao: data('2026-10-19') })] });
  await agendarAtendimentoService(dadosBase);
});

test('consulta somente sessões e atendimentos ativos do aluno e oficinas ativas', async (t) => {
  const { tx } = simularBanco(t);
  await agendarAtendimentoService(dadosBase);
  const filtroSessoes = tx.atendimento_sessao.findMany.mock.calls[0].arguments[0].where;
  assert.equal(filtroSessoes.status, 'ATIVO');
  assert.deepEqual(filtroSessoes.atendimento_clinico, { aluno_id: 1, status: 'ATIVO' });
  assert.deepEqual(filtroSessoes.data_sessao, { lte: data('2026-10-26') });
  const filtroOficinas = tx.matricula_turma.findMany.mock.calls[0].arguments[0].where;
  assert.equal(filtroOficinas.aluno_id, 1);
  assert.deepEqual(filtroOficinas.OR, [{ status: 'ATIVO' }, { status: 'INATIVO', data_fim: { not: null } }]);
  assert.deepEqual(filtroOficinas.turma, { tipo: 'OFICINA', status: 'ATIVO' });
});

test('informa oficina e matrícula que impedem o atendimento', async (t) => {
  const { tx } = simularBanco(t, { matriculas: [oficinaExistente()] });
  const conflito = await verificarConflito(() => agendarAtendimentoService(dadosBase), 'CHOQUE_HORARIO_OFICINA');
  assert.equal(conflito.detalhes.oficina_nome, 'Música');
  assert.equal(conflito.detalhes.matricula_id, 30);
  verificarSemGravacao(tx);
});

test('aceita oficinas consecutivas e oficinas em outro dia da semana', async (t) => {
  simularBanco(t, { matriculas: [oficinaExistente({ turma: { nome: 'Música', horarios: [
    { dia_semana: 1, hora_inicio: hora('08:00'), hora_fim: hora('09:00') },
    { dia_semana: 1, hora_inicio: hora('10:00'), hora_fim: hora('11:00') },
    { dia_semana: 2, hora_inicio: hora('09:00'), hora_fim: hora('10:00') }
  ] } })] });
  await agendarAtendimentoService(dadosBase);
});

test('respeita períodos de matrícula, inclusive dentro de uma recorrência', async (t) => {
  const { tx } = simularBanco(t, { matriculas: [oficinaExistente({
    data_inicio: data('2026-11-02'), data_fim: data('2026-11-02')
  })] });
  const conflito = await verificarConflito(() => agendarAtendimentoService({
    ...dadosBase, tipo_recorrencia: 'SEMANAL', frequencia: 1,
    dias_semana: [1], data_termino: '2026-11-09'
  }), 'CHOQUE_HORARIO_OFICINA');
  assert.equal(conflito.data_sessao, '2026-11-02');
  verificarSemGravacao(tx);
});

test('ignora oficinas fora do período de matrícula', async (t) => {
  simularBanco(t, { matriculas: [
    oficinaExistente({ data_inicio: data('2026-10-27') }),
    oficinaExistente({ data_fim: data('2026-10-25') })
  ] });
  await agendarAtendimentoService(dadosBase);
});

test('agrega conflitos de frequência, atendimento e oficina sem gravar', async (t) => {
  const { tx } = simularBanco(t, {
    aluno: { dias_frequencia: [] }, sessoes: [sessaoExistente()], matriculas: [oficinaExistente()]
  });
  await assert.rejects(() => agendarAtendimentoService(dadosBase), (erro) => {
    assert.deepEqual(new Set(erro.detalhes.map((item) => item.codigo)), new Set([
      'FREQUENCIA_INSUFICIENTE', 'CHOQUE_HORARIO_ATENDIMENTO', 'CHOQUE_HORARIO_OFICINA'
    ]));
    return true;
  });
  verificarSemGravacao(tx);
});

test('salva todas as sessões de uma recorrência livre no mesmo lote', async (t) => {
  const { tx } = simularBanco(t);
  await agendarAtendimentoService({
    ...dadosBase, tipo_recorrencia: 'SEMANAL', frequencia: 1,
    dias_semana: [1], data_termino: '2026-11-09'
  });
  assert.deepEqual(tx.atendimento_sessao.createMany.mock.calls[0].arguments[0].data
    .map((sessao) => sessao.data_sessao.toISOString().slice(0, 10)),
  ['2026-10-26', '2026-11-02', '2026-11-09']);
  assert.equal(prisma.$transaction.mock.callCount(), 1);
});

test('duas criações simultâneas consultam a agenda após adquirir o bloqueio', async (t) => {
  const sessoes = [];
  const { tx } = simularBanco(t, { sessoes });
  let fila = Promise.resolve();
  tx.atendimento_sessao.createMany.mock.mockImplementation(async ({ data: registros }) => {
    sessoes.push(...registros.map((registro) => sessaoExistente(registro)));
    return { count: registros.length };
  });
  // Simula a espera pelo bloqueio de linha e sua liberação ao terminar a transação.
  prisma.$transaction.mock.mockImplementation(async (operacao, opcoes) => {
    assert.equal(opcoes.isolationLevel, 'ReadCommitted');
    let liberar;
    const txConcorrente = {
      ...tx,
      async $queryRaw(...args) {
        const anterior = fila;
        fila = new Promise((resolve) => { liberar = resolve; });
        await anterior;
        return tx.$queryRaw(...args);
      }
    };
    try {
      return await operacao(txConcorrente);
    } finally {
      liberar?.();
    }
  });

  const resultados = await Promise.allSettled([
    agendarAtendimentoService(dadosBase), agendarAtendimentoService(dadosBase)
  ]);
  assert.equal(resultados.filter((resultado) => resultado.status === 'fulfilled').length, 1);
  const rejeitado = resultados.find((resultado) => resultado.status === 'rejected');
  assert.equal(rejeitado.reason.detalhes[0].codigo, 'CHOQUE_HORARIO_ATENDIMENTO');
  assert.equal(tx.atendimento_clinico.create.mock.callCount(), 1);
  assert.equal(sessoes.length, 1);
});

test('propaga falha ao gravar sessões pela transação, sem retornar sucesso', async (t) => {
  const { tx } = simularBanco(t);
  tx.atendimento_sessao.createMany.mock.mockImplementation(async () => { throw new Error('Falha no lote'); });
  await assert.rejects(() => agendarAtendimentoService(dadosBase), /Falha no lote/);
  assert.equal(tx.atendimento_clinico.findUnique.mock.callCount(), 0);
});

test('reconhece sessão clínica que começou no dia anterior', async (t) => {
  simularBanco(t, { sessoes: [sessaoExistente({
    data_sessao: data('2026-10-25'), hora_inicio: hora('23:30'), duracao_minutos: 120
  })] });
  await verificarConflito(() => agendarAtendimentoService({
    ...dadosBase, hora_inicio: '00:30'
  }), 'CHOQUE_HORARIO_ATENDIMENTO');
});

test('verifica frequência no dia seguinte quando a sessão atravessa meia-noite', async (t) => {
  simularBanco(t, { aluno: { dias_frequencia: [1] } });
  const conflito = await verificarConflito(() => agendarAtendimentoService({
    ...dadosBase, hora_inicio: '23:30', duracao_minutos: 60
  }), 'FREQUENCIA_INSUFICIENTE');
  assert.equal(conflito.detalhes.data, '2026-10-27');
});

test('terminar exatamente à meia-noite não exige frequência no dia seguinte', async (t) => {
  simularBanco(t, { aluno: { dias_frequencia: [1] } });
  await agendarAtendimentoService({ ...dadosBase, hora_inicio: '23:00' });
});

test('detecta oficina iniciada no dia anterior que atravessa meia-noite', async (t) => {
  simularBanco(t, { matriculas: [oficinaExistente({ turma: { nome: 'Música', horarios: [
    { dia_semana: 7, hora_inicio: hora('23:30'), hora_fim: hora('01:30') }
  ] } })] });
  await verificarConflito(() => agendarAtendimentoService({
    ...dadosBase, hora_inicio: '00:30'
  }), 'CHOQUE_HORARIO_OFICINA');
});

async function chamarController(body) {
  const res = {
    status(codigo) { this.statusCode = codigo; return this; },
    json(conteudo) { this.body = conteudo; return this; }
  };
  await criarAtendimento({ body }, res);
  return res;
}

test('controller devolve 409 com conflitos específicos', async (t) => {
  simularBanco(t, { matriculas: [oficinaExistente()] });
  const resposta = await chamarController(dadosBase);
  assert.equal(resposta.statusCode, 409);
  assert.equal(resposta.body.erro, 'Conflitos de agenda identificados.');
  assert.equal(resposta.body.conflitos[0].codigo, 'CHOQUE_HORARIO_OFICINA');
});

test('controller devolve 404 para aluno inexistente', async (t) => {
  simularBanco(t, { aluno: null });
  assert.equal((await chamarController(dadosBase)).statusCode, 404);
});

test('controller preserva 201 na criação e 400 na entrada inválida', async (t) => {
  simularBanco(t);
  assert.equal((await chamarController(dadosBase)).statusCode, 201);
  const resposta = await chamarController({ ...dadosBase, hora_inicio: '25:00' });
  assert.equal(resposta.statusCode, 400);
  assert.ok(Array.isArray(resposta.body.erros));
});

test('oficina cancelada ainda impede atendimento dentro da vigência histórica', async (t) => {
  simularBanco(t, { matriculas: [oficinaExistente({
    status: 'INATIVO', data_inicio: data('2026-10-01'), data_fim: data('2026-10-26')
  })] });
  await verificarConflito(() => agendarAtendimentoService(dadosBase), 'CHOQUE_HORARIO_OFICINA');
});

test('oficina cancelada não bloqueia atendimento depois da vigência', async (t) => {
  simularBanco(t, { matriculas: [oficinaExistente({
    status: 'INATIVO', data_inicio: data('2026-10-01'), data_fim: data('2026-10-25')
  })] });
  await agendarAtendimentoService(dadosBase);
});

test('continuação noturna cancelada não bloqueia o dia seguinte', async (t) => {
  simularBanco(t, { matriculas: [oficinaExistente({
    status: 'INATIVO', data_fim: data('2026-10-26'),
    turma: { nome: 'Música', horarios: [
      { dia_semana: 1, hora_inicio: hora('23:30'), hora_fim: hora('01:30') }
    ] }
  })] });
  await agendarAtendimentoService({ ...dadosBase, data_inicio: '2026-10-27', hora_inicio: '00:30' });
});

test('última noite da oficina continua bloqueando até o fim da vigência', async (t) => {
  simularBanco(t, { matriculas: [oficinaExistente({
    status: 'INATIVO', data_fim: data('2026-10-26'),
    turma: { nome: 'Música', horarios: [
      { dia_semana: 1, hora_inicio: hora('23:30'), hora_fim: hora('01:30') }
    ] }
  })] });
  await verificarConflito(() => agendarAtendimentoService({ ...dadosBase, hora_inicio: '23:45', duracao_minutos: 30 }),
    'CHOQUE_HORARIO_OFICINA');
});

test('seletor de profissionais usa IDs reais e retorna somente nome e cargo', async (t) => {
  const original = prisma.funcionario.findMany;
  t.after(() => { prisma.funcionario.findMany = original; });
  prisma.funcionario.findMany = t.mock.fn(async ({ where }) => {
    assert.deepEqual(where, { pessoa: { status_geral: 'ATIVO' } });
    return [{ id: 2, cargo: 'Terapeuta', pessoa: { nome: 'Ana', telefone: 'telefone interno' } }];
  });
  assert.deepEqual(await listarProfissionaisAtendimentoService(), [{ id: 2, nome: 'Ana', cargo: 'Terapeuta' }]);
});

test('consulta de profissionais responde 200 mesmo sem cadastros ativos', async (t) => {
  const original = prisma.funcionario.findMany;
  t.after(() => { prisma.funcionario.findMany = original; });
  prisma.funcionario.findMany = t.mock.fn(async () => []);
  const res = {
    status(codigo) { this.statusCode = codigo; return this; },
    json(body) { this.body = body; return this; }
  };
  await listarProfissionais({}, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, []);
});

test('falha na consulta de profissionais retorna mensagem pública sem detalhes internos', async (t) => {
  const original = prisma.funcionario.findMany;
  t.after(() => { prisma.funcionario.findMany = original; });
  prisma.funcionario.findMany = t.mock.fn(async () => { throw new Error('Detalhe interno de conexão'); });
  t.mock.method(console, 'error', () => {});
  const res = {
    status(codigo) { this.statusCode = codigo; return this; },
    json(body) { this.body = body; return this; }
  };
  await listarProfissionais({}, res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { erro: 'Erro interno ao listar profissionais.' });
});

for (const [nome, inicio, horario] of [
  ['dia anterior mesmo com horário mais tarde', '2026-10-25', '23:59'],
  ['horário anterior no mesmo dia', '2026-10-26', '09:29'],
  ['minuto atual que já começou', '2026-10-26', '09:30']
]) {
  test(`impede criação no passado: ${nome}`, async (t) => {
    const { tx } = simularBanco(t, { agora: '2026-10-26T12:30:30.500Z' });
    await assert.rejects(() => agendarAtendimentoService({ ...dadosBase, data_inicio: inicio, hora_inicio: horario }),
      { statusCode: 400, message: 'Não é possível agendar um atendimento em uma data ou horário no passado.' });
    assert.equal(prisma.$transaction.mock.callCount(), 0);
    verificarSemGravacao(tx);
  });
}

test('permite o próximo minuto no mesmo dia', async (t) => {
  simularBanco(t, { agora: '2026-10-26T12:30:30.500Z' });
  await agendarAtendimentoService({ ...dadosBase, hora_inicio: '09:31' });
});

test('permite horário mais cedo quando a data é futura', async (t) => {
  simularBanco(t, { agora: '2026-10-26T12:30:30.500Z' });
  await agendarAtendimentoService({ ...dadosBase, data_inicio: '2026-10-27', hora_inicio: '00:15' });
});

test('permite início no instante exato, mas rejeita se já passou um milissegundo', async (t) => {
  const { tx } = simularBanco(t, { agora: '2026-10-26T12:30:00.000Z' });
  await agendarAtendimentoService({ ...dadosBase, hora_inicio: '09:30' });
  t.mock.timers.tick(1);
  await assert.rejects(() => agendarAtendimentoService({ ...dadosBase, hora_inicio: '09:30' }), { statusCode: 400 });
  assert.equal(tx.atendimento_clinico.create.mock.callCount(), 1);
});

test('usa o dia e horário de São Paulo quando UTC já está no dia seguinte', async (t) => {
  simularBanco(t, { aluno: { dias_frequencia: [7] }, agora: '2026-10-26T01:00:00.000Z' });
  await agendarAtendimentoService({ ...dadosBase, data_inicio: '2026-10-25', hora_inicio: '22:01' });
  await assert.rejects(() => agendarAtendimentoService({ ...dadosBase, data_inicio: '2026-10-25', hora_inicio: '21:59' }),
    { statusCode: 400 });
});

test('permite meia-noite futura na virada do dia de São Paulo', async (t) => {
  simularBanco(t, { agora: '2026-10-26T02:59:30.000Z' });
  await agendarAtendimentoService({ ...dadosBase, hora_inicio: '00:00' });
});

for (const tipo of ['SEMANAL', 'MENSAL']) {
  test(`impede início passado na recorrência ${tipo}, mesmo com sessões futuras`, async (t) => {
    const { tx } = simularBanco(t, { agora: '2026-10-26T12:30:00.000Z' });
    await assert.rejects(() => agendarAtendimentoService({ ...dadosBase, tipo_recorrencia: tipo,
      frequencia: 1, dias_semana: [3], data_termino: '2026-11-26' }), { statusCode: 400 });
    verificarSemGravacao(tx);
  });
}

test('revalida o horário antes de gravar se o início passou enquanto aguardava a transação', async (t) => {
  const { tx } = simularBanco(t, { agora: '2026-10-26T12:29:59.000Z' });
  tx.$queryRaw.mock.mockImplementation(async () => { t.mock.timers.tick(2000); return []; });
  await assert.rejects(() => agendarAtendimentoService({ ...dadosBase, hora_inicio: '09:30' }), { statusCode: 400 });
  assert.equal(prisma.$transaction.mock.callCount(), 1);
  verificarSemGravacao(tx);
});

test('API responde 400 para início passado e não grava atendimento ou sessões', async (t) => {
  const { tx } = simularBanco(t, { agora: '2026-10-26T12:30:00.000Z' });
  const resposta = await chamarController(dadosBase);
  assert.equal(resposta.statusCode, 400);
  assert.match(resposta.body.erro, /passado/);
  verificarSemGravacao(tx);
});
