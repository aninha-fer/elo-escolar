const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { obterAgendaAlunoService } = require('./agendaService');
const { obterAlunoService } = require('./alunoService');
const { obterAgenda } = require('../controllers/agendaController');

const data = (valor) => new Date(`${valor}T00:00:00.000Z`);
const hora = (valor) => new Date(`1970-01-01T${valor}:00.000Z`);

function sessao(alteracoes = {}) {
  return {
    id: 10, atendimento_clinico_id: 20, status: 'ATIVO',
    data_sessao: data('2026-11-02'), hora_inicio: hora('09:00'), duracao_minutos: 45,
    atendimento_clinico: {
      aluno_id: 1, status: 'ATIVO', modalidade: 'Fisioterapia',
      profissional: { pessoa: { nome: 'Ana' } }
    },
    ...alteracoes
  };
}

function matricula(alteracoes = {}) {
  return {
    id: 30, aluno_id: 1, status: 'ATIVO', data_inicio: null, data_fim: null,
    turma: {
      id: 40, nome: 'Música', tipo: 'OFICINA', status: 'ATIVO',
      ambiente: { nome: 'Sala 1' }, profissional: { pessoa: { nome: 'João' } },
      horarios: [{ id: 50, dia_semana: 1, hora_inicio: hora('10:00'), hora_fim: hora('11:00') }]
    },
    ...alteracoes
  };
}

// Aplica aos dados de teste os filtros recebidos pelas consultas Prisma.
function corresponde(registro, filtro) {
  return Object.entries(filtro).every(([campo, esperado]) => {
    if (campo === 'AND') return esperado.every((item) => corresponde(registro, item));
    if (campo === 'OR') return esperado.some((item) => corresponde(registro, item));
    const atual = registro[campo];
    if (esperado === null || typeof esperado !== 'object') return atual === esperado;
    if ('not' in esperado) return atual != null && atual !== esperado.not;
    if ('lt' in esperado) return atual !== null && atual < esperado.lt;
    if ('gte' in esperado) return atual !== null && atual >= esperado.gte;
    return atual != null && corresponde(atual, esperado);
  });
}

function simularBanco(t, { aluno = { id: 1 }, sessoes = [], matriculas = [] } = {}) {
  function substituir(objeto, metodo, implementacao) {
    const original = objeto[metodo];
    t.after(() => { objeto[metodo] = original; });
    objeto[metodo] = t.mock.fn(implementacao);
    return objeto[metodo];
  }
  return {
    aluno: substituir(prisma.aluno, 'findUnique', async () => aluno),
    matriculas: substituir(prisma.matricula_turma, 'findMany', async ({ where }) =>
      matriculas.filter((item) => corresponde(item, where))),
    sessoes: substituir(prisma.atendimento_sessao, 'findMany', async ({ where }) =>
      sessoes.filter((item) => corresponde(item, where)))
  };
}

test('sem data usa a semana atual em São Paulo, mesmo quando UTC já é segunda', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-02T01:30:00.000Z') });
  simularBanco(t);
  assert.deepEqual(await obterAgendaAlunoService(1), {
    semana_inicio: '2026-10-26', semana_fim: '2026-11-01', eventos: []
  });
});

for (const referencia of ['2026-11-02', '2026-11-04', '2026-11-08']) {
  test(`normaliza ${referencia} para a mesma semana de segunda a domingo`, async (t) => {
    simularBanco(t);
    assert.deepEqual(await obterAgendaAlunoService(1, referencia), {
      semana_inicio: '2026-11-02', semana_fim: '2026-11-08', eventos: []
    });
  });
}

test('calcula semana que atravessa o ano', async (t) => {
  simularBanco(t);
  const agenda = await obterAgendaAlunoService(1, '2026-01-01');
  assert.equal(agenda.semana_inicio, '2025-12-29');
  assert.equal(agenda.semana_fim, '2026-01-04');
});

test('aceita dia bissexto válido', async (t) => {
  simularBanco(t);
  const agenda = await obterAgendaAlunoService(1, '2024-02-29');
  assert.equal(agenda.semana_inicio, '2024-02-26');
  assert.equal(agenda.semana_fim, '2024-03-03');
});

test('retorna 404 para aluno inexistente sem consultar seus compromissos', async (t) => {
  const banco = simularBanco(t, { aluno: null });
  await assert.rejects(() => obterAgendaAlunoService(1, '2026-11-04'), { status: 404 });
  assert.equal(banco.sessoes.mock.callCount(), 0);
  assert.equal(banco.matriculas.mock.callCount(), 0);
});

test('projeta turmas e oficinas e reúne sessões clínicas em ordem cronológica', async (t) => {
  const regular = matricula();
  regular.id = 31;
  regular.turma = { ...regular.turma, id: 41, tipo: 'REGULAR', nome: 'Turma A', horarios: [
    { id: 51, dia_semana: 2, hora_inicio: hora('08:00'), hora_fim: hora('12:00') }
  ] };
  simularBanco(t, { matriculas: [regular, matricula()], sessoes: [
    sessao({ id: 11, data_sessao: data('2026-11-04') }), sessao()
  ] });
  const { eventos } = await obterAgendaAlunoService(1, '2026-11-04');
  assert.deepEqual(eventos.map((evento) => [evento.data, evento.tipo, evento.hora_inicio]), [
    ['2026-11-02', 'ATENDIMENTO', '09:00'], ['2026-11-02', 'OFICINA', '10:00'],
    ['2026-11-03', 'REGULAR', '08:00'], ['2026-11-04', 'ATENDIMENTO', '09:00']
  ]);
  assert.equal(new Set(eventos.map((evento) => evento.id)).size, 4);
  assert.equal(eventos[0].titulo, 'Fisioterapia');
  assert.equal(eventos[0].profissional, 'Ana');
  assert.equal(eventos[0].hora_fim, '09:45');
  assert.equal(eventos[0].sessao_id, 10);
  assert.equal(eventos[0].atendimento_id, 20);
  assert.equal(eventos[1].ambiente, 'Sala 1');
});

test('usa duração e horário próprios da sessão, sem recalcular a recorrência', async (t) => {
  const registro = sessao();
  registro.atendimento_clinico = {
    ...registro.atendimento_clinico, tipo_recorrencia: 'SEMANAL',
    hora_inicio: hora('08:00'), duracao_minutos: 90
  };
  simularBanco(t, { sessoes: [registro] });
  const { eventos } = await obterAgendaAlunoService(1, '2026-11-04');
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].hora_inicio, '09:00');
  assert.equal(eventos[0].hora_fim, '09:45');
});

test('não repete sessão eventual ou recorrente em semanas sem ocorrência', async (t) => {
  simularBanco(t, { sessoes: [sessao()] });
  assert.deepEqual((await obterAgendaAlunoService(1, '2026-11-11')).eventos, []);
});

test('respeita vigência inclusiva da matrícula em cada dia da semana', async (t) => {
  const registro = matricula({ data_inicio: data('2026-11-04'), data_fim: data('2026-11-05') });
  registro.turma.horarios = [1, 2, 3, 4, 5].map((dia) => ({
    id: dia, dia_semana: dia, hora_inicio: hora('10:00'), hora_fim: hora('11:00')
  }));
  simularBanco(t, { matriculas: [registro] });
  assert.deepEqual((await obterAgendaAlunoService(1, '2026-11-02')).eventos.map((evento) => evento.data),
    ['2026-11-04', '2026-11-05']);
});

test('não inclui matrículas antes do início ou depois do término', async (t) => {
  simularBanco(t, { matriculas: [
    matricula({ data_inicio: data('2026-11-09') }), matricula({ data_fim: data('2026-11-01') })
  ] });
  assert.deepEqual((await obterAgendaAlunoService(1, '2026-11-04')).eventos, []);
});

test('filtra sessões, atendimentos, turmas e matrículas inativos e outros alunos', async (t) => {
  const atendimentoInativo = sessao();
  atendimentoInativo.atendimento_clinico.status = 'INATIVO';
  const outroAluno = sessao();
  outroAluno.atendimento_clinico.aluno_id = 2;
  const turmaInativa = matricula();
  turmaInativa.turma.status = 'INATIVO';
  simularBanco(t, { sessoes: [sessao({ status: 'INATIVO' }), atendimentoInativo, outroAluno],
    matriculas: [matricula({ status: 'INATIVO' }), turmaInativa, matricula({ aluno_id: 2 })] });
  assert.deepEqual((await obterAgendaAlunoService(1, '2026-11-04')).eventos, []);
});

test('inclui sábado, domingo e horários fora da grade escolar', async (t) => {
  simularBanco(t, { sessoes: [
    sessao({ data_sessao: data('2026-11-07'), hora_inicio: hora('06:00') }),
    sessao({ id: 11, data_sessao: data('2026-11-08'), hora_inicio: hora('20:00') })
  ] });
  assert.deepEqual((await obterAgendaAlunoService(1, '2026-11-04')).eventos
    .map((evento) => [evento.dia_semana, evento.hora_inicio]), [[6, '06:00'], [7, '20:00']]);
});

test('divide sessões à meia-noite e recorta eventos nos limites da semana', async (t) => {
  simularBanco(t, { sessoes: [
    sessao({ id: 1, data_sessao: data('2026-11-01'), hora_inicio: hora('23:30'), duracao_minutos: 120 }),
    sessao({ id: 2, data_sessao: data('2026-11-04'), hora_inicio: hora('23:30'), duracao_minutos: 60 }),
    sessao({ id: 3, data_sessao: data('2026-11-08'), hora_inicio: hora('23:30'), duracao_minutos: 120 }),
    sessao({ id: 4, data_sessao: data('2026-11-09'), hora_inicio: hora('00:00') })
  ] });
  const { eventos } = await obterAgendaAlunoService(1, '2026-11-04');
  assert.deepEqual(eventos.map((evento) => [evento.data, evento.hora_inicio, evento.hora_fim]), [
    ['2026-11-02', '00:00', '01:30'], ['2026-11-04', '23:30', '24:00'],
    ['2026-11-05', '00:00', '00:30'], ['2026-11-08', '23:30', '24:00']
  ]);
  assert.equal(new Set(eventos.map((evento) => evento.id)).size, 4);
});

test('término exatamente no início da semana não gera evento', async (t) => {
  simularBanco(t, { sessoes: [sessao({
    data_sessao: data('2026-11-01'), hora_inicio: hora('23:00'), duracao_minutos: 60
  })] });
  assert.deepEqual((await obterAgendaAlunoService(1, '2026-11-04')).eventos, []);
});

test('inclui continuação de oficina do domingo anterior sem repetir eventos', async (t) => {
  const registro = matricula();
  registro.turma.horarios = [
    { id: 51, dia_semana: 7, hora_inicio: hora('23:30'), hora_fim: hora('01:30') }
  ];
  simularBanco(t, { matriculas: [registro] });
  assert.deepEqual((await obterAgendaAlunoService(1, '2026-11-04')).eventos
    .map((evento) => [evento.data, evento.hora_inicio, evento.hora_fim]), [
    ['2026-11-02', '00:00', '01:30'], ['2026-11-08', '23:30', '24:00']
  ]);
});

test('consulta período com fim exclusivo e mantém os dados persistidos intactos', async (t) => {
  const registros = { matriculas: [matricula()], sessoes: [sessao()] };
  const antes = structuredClone(registros);
  const banco = simularBanco(t, registros);
  await obterAgendaAlunoService(1, '2026-11-04');
  assert.deepEqual(registros, antes);
  assert.deepEqual(banco.sessoes.mock.calls[0].arguments[0].where.data_sessao, { lt: data('2026-11-09') });
});

async function chamarController(query = {}, id = '1') {
  const resposta = {
    status(codigo) { this.statusCode = codigo; return this; },
    json(body) { this.body = body; return this; }
  };
  await obterAgenda({ params: { id }, query }, resposta);
  return resposta;
}

test('controller responde 200 com período e eventos para a semana solicitada', async (t) => {
  simularBanco(t, { sessoes: [sessao()] });
  const resposta = await chamarController({ data: '2026-11-04' });
  assert.equal(resposta.statusCode, 200);
  assert.equal(resposta.body.semana_inicio, '2026-11-02');
  assert.equal(resposta.body.eventos.length, 1);
});

for (const valor of ['', '2026-02-30', '2026-13-01', '04/11/2026', '2026-11-04T00:00:00Z', ['2026-11-04']]) {
  test(`controller rejeita data inválida ${JSON.stringify(valor)} antes de consultar o banco`, async (t) => {
    const banco = simularBanco(t);
    const resposta = await chamarController({ data: valor });
    assert.equal(resposta.statusCode, 400);
    assert.ok(resposta.body.erros.length > 0);
    assert.equal(banco.aluno.mock.callCount(), 0);
  });
}

test('controller responde 404 para aluno ausente e 400 para ID inválido', async (t) => {
  simularBanco(t, { aluno: null });
  assert.equal((await chamarController({ data: '2026-11-04' })).statusCode, 404);
  assert.equal((await chamarController({}, 'abc')).statusCode, 400);
});

test('detalhe do aluno informa turma regular independentemente da semana', async (t) => {
  const turma = { id: 40, nome: 'Turma A', turno: 'MANHA' };
  const banco = simularBanco(t, { aluno: { id: 1, pessoa: { nome: 'Aluno' }, matriculas_turmas: [{ turma }] } });
  const aluno = await obterAlunoService(1);
  assert.deepEqual(aluno.turma_regular, turma);
  assert.equal(aluno.matriculas_turmas, undefined);
  assert.equal(banco.aluno.mock.calls[0].arguments[0].include.matriculas_turmas.where.turma.tipo, 'REGULAR');
});

test('detalhe sem turma regular ou sem aluno preserva respostas nulas', async (t) => {
  const banco = simularBanco(t, { aluno: { id: 1, matriculas_turmas: [] } });
  assert.equal((await obterAlunoService(1)).turma_regular, null);
  banco.aluno.mock.mockImplementation(async () => null);
  assert.equal(await obterAlunoService(1), null);
});

test('inscrição cancelada continua visível até data_fim, inclusive', async (t) => {
  const registro = matricula({ status: 'INATIVO', data_inicio: data('2026-11-02'), data_fim: data('2026-11-03') });
  registro.turma.horarios = [1, 2, 3, 4, 5].map((dia) => ({
    id: dia, dia_semana: dia, hora_inicio: hora('10:00'), hora_fim: hora('11:00')
  }));
  simularBanco(t, { matriculas: [registro] });
  assert.deepEqual((await obterAgendaAlunoService(1, '2026-11-04')).eventos.map((evento) => evento.data),
    ['2026-11-02', '2026-11-03']);
  assert.deepEqual((await obterAgendaAlunoService(1, '2026-11-11')).eventos, []);
});

test('cancelamento no dia da inscrição não inventa atividades históricas', async (t) => {
  simularBanco(t, { matriculas: [matricula({ status: 'INATIVO', data_inicio: data('2026-11-02'), data_fim: data('2026-11-01') })] });
  assert.deepEqual((await obterAgendaAlunoService(1, '2026-11-04')).eventos, []);
  assert.deepEqual((await obterAgendaAlunoService(1, '2026-10-28')).eventos, []);
});

test('oficina encerrada à meia-noite não avança para o dia seguinte', async (t) => {
  const registro = matricula({ status: 'INATIVO', data_fim: data('2026-11-03') });
  registro.turma.horarios = [
    { id: 51, dia_semana: 2, hora_inicio: hora('23:30'), hora_fim: hora('01:30') }
  ];
  simularBanco(t, { matriculas: [registro] });
  assert.deepEqual((await obterAgendaAlunoService(1, '2026-11-04')).eventos
    .map((evento) => [evento.data, evento.hora_inicio, evento.hora_fim]), [['2026-11-03', '23:30', '24:00']]);
});

test('continuação noturna encerrada no domingo não aparece na próxima semana', async (t) => {
  const registro = matricula({ status: 'INATIVO', data_fim: data('2026-11-01') });
  registro.turma.horarios = [
    { id: 51, dia_semana: 7, hora_inicio: hora('23:30'), hora_fim: hora('01:30') }
  ];
  simularBanco(t, { matriculas: [registro] });
  assert.deepEqual((await obterAgendaAlunoService(1, '2026-11-04')).eventos, []);
  assert.deepEqual((await obterAgendaAlunoService(1, '2026-10-28')).eventos
    .filter((evento) => evento.data === '2026-11-01').map((evento) => evento.hora_fim), ['24:00']);
});
