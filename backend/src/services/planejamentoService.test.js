const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { criarAlunoService, obterAlunoService, obterOficinasService, obterAtendimentosService } = require('./alunoService');
const { matricularOficinasService, matricularTurmaRegularService, removerMatriculaProvisoriaService, cancelarOficinaService } = require('./matriculaService');
const { agendarAtendimentoService, removerAtendimentoProvisorioService } = require('./atendimentoService');
const { obterAgendaAlunoService } = require('./agendaService');
const { listarTurmasService, listarTurmasRegularesPorTurnoService } = require('./turmaService');
const { removerMatriculaProvisoria } = require('../controllers/matriculaController');
const { removerAtendimentoProvisorio } = require('../controllers/atendimentoController');

const data = (valor) => new Date(`${valor}T00:00:00.000Z`);
const hora = (valor) => new Date(`1970-01-01T${valor}:00.000Z`);
const aluno = (id, status = 'RASCUNHO') => ({ id, pessoa_id: id, status, turno: 'MANHA', dias_frequencia: [1, 2, 3, 4, 5] });
const turma = (id, tipo = 'OFICINA', capacidade_maxima = 1) => ({
  id, tipo, capacidade_maxima, status: 'ATIVO', nome: `Turma ${id}`, turno: 'MANHA',
  horarios: (tipo === 'REGULAR' ? [1, 2, 3, 4, 5] : [1]).map((dia_semana) => ({
    id: dia_semana, dia_semana, hora_inicio: hora(tipo === 'REGULAR' ? '08:00' : '09:00'),
    hora_fim: hora(tipo === 'REGULAR' ? '12:00' : '10:00')
  }))
});
const pedidoClinico = { aluno_id: 1, profissional_id: 1, modalidade: 'Psicologia', tipo_recorrencia: 'EVENTUAL',
  data_inicio: '2026-11-02', hora_inicio: '09:30', duracao_minutos: 30 };

function corresponde(registro, filtro = {}) {
  return Object.entries(filtro).every(([campo, esperado]) => {
    if (campo === 'OR') return esperado.some((item) => corresponde(registro, item));
    if (campo === 'AND') return esperado.every((item) => corresponde(registro, item));
    if (campo === 'is') return corresponde(registro, esperado);
    const atual = registro[campo];
    if (esperado === null || typeof esperado !== 'object') return atual === esperado;
    if ('not' in esperado) return atual != null && atual !== esperado.not;
    if ('in' in esperado) return esperado.in.includes(atual);
    if ('lt' in esperado) return atual != null && atual < esperado.lt;
    if ('lte' in esperado) return atual != null && atual <= esperado.lte;
    if ('gte' in esperado) return atual != null && atual >= esperado.gte;
    return atual != null && corresponde(atual, esperado);
  });
}

// Transações com gravações pendentes e bloqueios por registro para exercitar os services juntos.
function simularBanco(t, inicial = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-02T12:00:00.000Z') });
  const estado = { aluno: [aluno(1), aluno(2, 'ATIVO'), aluno(3, 'ATIVO')], pessoa: [],
    turma: [turma(10), turma(20, 'REGULAR')], matricula_turma: [], atendimento_clinico: [], atendimento_sessao: [],
    aluno_responsavel: [], aluno_dados_medicos: [], ...inicial };
  let sequencia = 100;
  const filas = new Map();

  function cliente(pendentes, removidos, atualizados) {
    const ler = (nome) => [...estado[nome], ...pendentes[nome]].filter((item) => !removidos[nome].has(item.id))
      .map((item) => ({ ...item, ...atualizados[nome].get(item.id) }));
    function hidratar(nome, item) {
      if (nome === 'matricula_turma') return { ...item,
        aluno: ler('aluno').find((outro) => outro.id === item.aluno_id),
        turma: ler('turma').find((outro) => outro.id === item.turma_id) };
      if (nome === 'atendimento_clinico') return { ...item,
        aluno: ler('aluno').find((outro) => outro.id === item.aluno_id), profissional: { pessoa: { nome: 'Ana' } },
        sessoes: ler('atendimento_sessao').filter((outro) => outro.atendimento_clinico_id === item.id) };
      if (nome === 'atendimento_sessao') return { ...item,
        atendimento_clinico: hidratar('atendimento_clinico', ler('atendimento_clinico').find((outro) => outro.id === item.atendimento_clinico_id)) };
      return { ...item };
    }
    const resultado = {};
    for (const nome of Object.keys(estado)) {
      const buscar = (where = {}) => ler(nome).map((item) => hidratar(nome, item)).filter((item) => corresponde(item, where));
      resultado[nome] = {
        async findUnique({ where, include }) {
          const item = buscar(where)[0] ?? null;
          if (item && nome === 'aluno' && include?.matriculas_turmas) {
            item.matriculas_turmas = await resultado.matricula_turma.findMany({ where: { aluno_id: item.id, ...include.matriculas_turmas.where } });
          }
          return item;
        },
        async findFirst({ where }) { return buscar(where)[0] ?? null; },
        async findMany({ where = {} } = {}) {
          const itens = buscar(where);
          if (nome === 'turma') for (const item of itens) item._count = {
            matriculas: ler('matricula_turma').filter((m) => m.turma_id === item.id && m.status === 'ATIVO').length
          };
          return itens;
        },
        async count({ where }) { return buscar(where).length; },
        async groupBy({ where }) {
          const contagem = new Map();
          for (const item of buscar(where)) contagem.set(item.turma_id, (contagem.get(item.turma_id) ?? 0) + 1);
          return [...contagem].map(([turma_id, total]) => ({ turma_id, _count: { turma_id: total } }));
        },
        async create({ data: valores }) {
          const item = { id: sequencia++, data_fim: null, ...valores };
          pendentes[nome].push(item);
          return { ...item };
        },
        async createMany({ data: valores }) {
          for (const item of valores) await resultado[nome].create({ data: item });
          return { count: valores.length };
        },
        async delete({ where }) {
          const item = buscar(where)[0];
          assert.ok(item);
          removidos[nome].add(item.id);
          return item;
        },
        async deleteMany({ where }) {
          const itens = buscar(where);
          for (const item of itens) removidos[nome].add(item.id);
          return { count: itens.length };
        },
        async update({ where, data: valores }) {
          const item = buscar(where)[0];
          assert.ok(item);
          atualizados[nome].set(item.id, valores);
          return { ...item, ...valores };
        }
      };
    }
    return resultado;
  }
  const vazios = (gerar) => Object.fromEntries(Object.keys(estado).map((nome) => [nome, gerar()]));
  const leitura = cliente(vazios(() => []), vazios(() => new Set()), vazios(() => new Map()));
  for (const nome of Object.keys(estado)) for (const [metodo, implementacao] of Object.entries(leitura[nome])) {
    const original = prisma[nome][metodo];
    t.after(() => { prisma[nome][metodo] = original; });
    prisma[nome][metodo] = t.mock.fn(implementacao);
  }
  const original = prisma.$transaction;
  t.after(() => { prisma.$transaction = original; });
  prisma.$transaction = t.mock.fn(async (operacao) => {
    const pendentes = vazios(() => []), removidos = vazios(() => new Set()), atualizados = vazios(() => new Map());
    const tx = cliente(pendentes, removidos, atualizados);
    const adquiridos = new Set(), liberar = [];
    tx.$queryRaw = async (sql, id) => {
      const chave = `${sql.join('?').includes('FROM "turma"') ? 'turma' : 'aluno'}:${id}`;
      if (adquiridos.has(chave)) return [];
      const anterior = filas.get(chave) ?? Promise.resolve();
      filas.set(chave, new Promise((resolve) => liberar.push(resolve)));
      await anterior;
      adquiridos.add(chave);
      return [];
    };
    try {
      const valor = await operacao(tx);
      for (const nome of Object.keys(estado)) estado[nome] = [...estado[nome], ...pendentes[nome]]
        .filter((item) => !removidos[nome].has(item.id)).map((item) => ({ ...item, ...atualizados[nome].get(item.id) }));
      return valor;
    } finally { for (const soltar of liberar) soltar(); }
  });
  return estado;
}

test('cadastro de rascunho aceita regular lotada e mantém pessoa inativa e vínculo provisório', async (t) => {
  const banco = simularBanco(t, { turma: [turma(20, 'REGULAR', 0)] });
  const criado = await criarAlunoService({ nome: 'Rascunho', status: 'RASCUNHO', turno: 'MANHA', dias_frequencia: [1, 2], turma_id: 20 });
  assert.equal(criado.status, 'RASCUNHO');
  assert.equal(banco.pessoa[0].status_geral, 'INATIVO');
  assert.equal(banco.matricula_turma[0].status, 'PROVISORIO');
  const [regular] = await listarTurmasRegularesPorTurnoService('MANHA');
  assert.equal(regular.vagas_ocupadas, 0);
});

test('regular lotada bloqueia cadastro ativo e reverte aluno e pessoa', async (t) => {
  const banco = simularBanco(t, { turma: [turma(20, 'REGULAR', 0)] });
  await assert.rejects(() => criarAlunoService({ nome: 'Ativo', status: 'ATIVO', turno: 'MANHA', dias_frequencia: [1], turma_id: 20,
    responsaveis: [{ nome: 'Responsável Teste' }], dados_medicos: { usa_medicamento: false } }), { isConflict: true });
  assert.equal(banco.aluno.length, 3);
  assert.equal(banco.pessoa.length, 0);
  assert.equal(banco.aluno_responsavel.length, 0);
  assert.equal(banco.aluno_dados_medicos.length, 0);
  assert.equal(banco.matricula_turma.length, 0);
});

for (const tipo of ['REGULAR', 'OFICINA']) {
  test(`${tipo}: capacidade nula permite várias matrículas efetivas e retorna disponibilidade nula`, async (t) => {
    const banco = simularBanco(t, { turma: [turma(10, tipo, null)] });
    for (const aluno_id of [2, 3]) {
      if (tipo === 'REGULAR') await matricularTurmaRegularService({ aluno_id, turma_id: 10 });
      else await matricularOficinasService({ aluno_id, oficinas_ids: [10] });
    }
    assert.equal(banco.matricula_turma.length, 2);
    const [item] = await listarTurmasService(tipo);
    assert.equal(item.vagas_ocupadas, 2);
    assert.equal(item.vagas_disponiveis, null);
  });
  test(`${tipo}: alunos distintos não conseguem ocupar simultaneamente a última vaga`, async (t) => {
    const banco = simularBanco(t, { turma: [turma(10, tipo, 1)] });
    const resultados = await Promise.allSettled([2, 3].map((aluno_id) => tipo === 'REGULAR'
      ? matricularTurmaRegularService({ aluno_id, turma_id: 10 }) : matricularOficinasService({ aluno_id, oficinas_ids: [10] })));
    assert.equal(resultados.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(banco.matricula_turma.length, 1);
  });
}

test('oficina lotada aceita rascunho sem ocupar vaga e bloqueia duplicidade no planejamento', async (t) => {
  const banco = simularBanco(t, { turma: [turma(10, 'OFICINA', 0)] });
  await matricularOficinasService({ aluno_id: 1, oficinas_ids: [10], status: 'ATIVO' });
  assert.equal(banco.matricula_turma[0].status, 'PROVISORIO');
  assert.equal((await listarTurmasService('OFICINA'))[0].vagas_ocupadas, 0);
  await assert.rejects(() => matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] }), { isConflict: true });
  assert.equal(banco.matricula_turma.length, 1);
});

for (const alteracao of [{ turno: 'TARDE' }, { horarios: [{ dia_semana: 6, hora_inicio: hora('09:00'), hora_fim: hora('10:00') }] }]) {
  test(`planejamento rejeita oficina incompatível: ${JSON.stringify(Object.keys(alteracao))}`, async (t) => {
    const banco = simularBanco(t, { turma: [{ ...turma(10), ...alteracao }] });
    await assert.rejects(() => matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] }), { isConflict: true });
    assert.equal(banco.matricula_turma.length, 0);
  });
}

for (const tipo_recorrencia of ['EVENTUAL', 'SEMANAL', 'MENSAL']) {
  test(`clínica ${tipo_recorrencia}: grava configuração e todas as sessões como provisórias`, async (t) => {
    const banco = simularBanco(t);
    await agendarAtendimentoService({ ...pedidoClinico, status: 'ATIVO', tipo_recorrencia, frequencia: 1,
      dias_semana: [1], data_termino: '2026-12-02' });
    assert.equal(banco.atendimento_clinico[0].status, 'PROVISORIO');
    assert.ok(banco.atendimento_sessao.length >= 1);
    assert.ok(banco.atendimento_sessao.every((item) => item.status === 'PROVISORIO'));
  });
}

for (const primeiro of ['oficina', 'atendimento']) {
  test(`conflitos provisórios são verificados com ${primeiro} incluído primeiro`, async (t) => {
    const banco = simularBanco(t);
    const oficina = () => matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] });
    const clinica = () => agendarAtendimentoService(pedidoClinico);
    await (primeiro === 'oficina' ? oficina() : clinica());
    await assert.rejects(primeiro === 'oficina' ? clinica : oficina, { isConflict: true });
    assert.equal(banco.matricula_turma.length + banco.atendimento_clinico.length, 1);
  });
}

test('regular pode sobrepor atividades provisórias e agenda/listagens identificam planejamento', async (t) => {
  const banco = simularBanco(t);
  await matricularTurmaRegularService({ aluno_id: 1, turma_id: 20 });
  await matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] });
  await agendarAtendimentoService({ ...pedidoClinico, hora_inicio: '11:00' });
  const agenda = await obterAgendaAlunoService(1, '2026-11-02');
  assert.ok(agenda.eventos.some((item) => item.tipo === 'REGULAR'));
  assert.ok(agenda.eventos.some((item) => item.tipo === 'OFICINA'));
  assert.ok(agenda.eventos.some((item) => item.tipo === 'ATENDIMENTO'));
  assert.ok(agenda.eventos.every((item) => item.status === 'PROVISORIO'));
  assert.equal((await obterAlunoService(1)).matricula_regular.status, 'PROVISORIO');
  assert.equal((await obterOficinasService(1))[0].status, 'PROVISORIO');
  assert.equal((await obterAtendimentosService(1))[0].status, 'PROVISORIO');
  assert.equal(banco.aluno[0].status, 'RASCUNHO');
});

test('duas oficinas provisórias não podem coincidir e uma segunda regular é rejeitada', async (t) => {
  const banco = simularBanco(t, { turma: [turma(10), turma(11), turma(20, 'REGULAR'), turma(21, 'REGULAR')] });
  await matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] });
  await assert.rejects(() => matricularOficinasService({ aluno_id: 1, oficinas_ids: [11] }), { isConflict: true });
  await matricularTurmaRegularService({ aluno_id: 1, turma_id: 20 });
  await assert.rejects(() => matricularTurmaRegularService({ aluno_id: 1, turma_id: 21 }), { isConflict: true });
  assert.equal(banco.matricula_turma.length, 2);
});

test('clínica provisória valida frequência e conflitos com outra clínica provisória', async (t) => {
  const banco = simularBanco(t);
  await agendarAtendimentoService(pedidoClinico);
  await assert.rejects(() => agendarAtendimentoService(pedidoClinico), { isConflict: true });
  await assert.rejects(() => agendarAtendimentoService({ ...pedidoClinico, data_inicio: '2026-11-07' }), { isConflict: true });
  assert.equal(banco.atendimento_clinico.length, 1);
});

test('planejamentos de outro aluno não provocam conflitos nem ocupam vagas', async (t) => {
  const banco = simularBanco(t, { aluno: [aluno(1), aluno(2)] });
  await agendarAtendimentoService(pedidoClinico);
  await agendarAtendimentoService({ ...pedidoClinico, aluno_id: 2 });
  await matricularOficinasService({ aluno_id: 2, oficinas_ids: [10] }).then(
    () => assert.fail('O conflito deve existir apenas com o atendimento do próprio aluno'),
    (erro) => assert.equal(erro.isConflict, true));
  assert.equal(banco.atendimento_clinico.length, 2);
});

for (const tipo of ['REGULAR', 'OFICINA']) {
  test(`remoção provisória de ${tipo} exclui somente o vínculo escolhido`, async (t) => {
    const banco = simularBanco(t, { turma: [turma(10, tipo)] });
    if (tipo === 'REGULAR') await matricularTurmaRegularService({ aluno_id: 1, turma_id: 10 });
    else await matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] });
    await removerMatriculaProvisoriaService({ aluno_id: 1, matricula_id: banco.matricula_turma[0].id });
    assert.equal(banco.matricula_turma.length, 0);
    assert.equal(banco.aluno[0].status, 'RASCUNHO');
  });
}

test('remoção de recorrência elimina todas as sessões e preserva outro atendimento', async (t) => {
  const banco = simularBanco(t);
  const primeiro = await agendarAtendimentoService({ ...pedidoClinico, tipo_recorrencia: 'SEMANAL', frequencia: 1,
    dias_semana: [1], data_termino: '2026-11-16' });
  const outro = await agendarAtendimentoService({ ...pedidoClinico, hora_inicio: '11:00' });
  assert.equal(banco.atendimento_sessao.length, 4);
  await removerAtendimentoProvisorioService({ aluno_id: 1, atendimento_id: primeiro.id });
  assert.deepEqual(banco.atendimento_clinico.map((item) => item.id), [outro.id]);
  assert.equal(banco.atendimento_sessao.length, 1);
  assert.equal(banco.atendimento_sessao[0].atendimento_clinico_id, outro.id);
});

test('remoção rejeita proprietário incorreto, vínculos efetivos e sessões com status misturado', async (t) => {
  const banco = simularBanco(t);
  const atendimento = await agendarAtendimentoService(pedidoClinico);
  await assert.rejects(() => removerAtendimentoProvisorioService({ aluno_id: 2, atendimento_id: atendimento.id }), { statusCode: 404 });
  banco.atendimento_sessao[0].status = 'ATIVO';
  await assert.rejects(() => removerAtendimentoProvisorioService({ aluno_id: 1, atendimento_id: atendimento.id }), { statusCode: 409 });
  assert.equal(banco.atendimento_sessao.length, 1);
  assert.equal(banco.atendimento_clinico.length, 1);
  banco.atendimento_clinico[0].status = 'ATIVO';
  await assert.rejects(() => removerAtendimentoProvisorioService({ aluno_id: 1, atendimento_id: atendimento.id }), { statusCode: 409 });
});

test('cancelamento efetivo rejeita inscrição provisória e não cria histórico de cancelamento', async (t) => {
  const banco = simularBanco(t);
  await matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] });
  const matricula_id = banco.matricula_turma[0].id;
  await assert.rejects(() => cancelarOficinaService({ aluno_id: 1, matricula_id }), { statusCode: 409 });
  assert.equal(banco.matricula_turma[0].status, 'PROVISORIO');
  assert.equal(banco.matricula_turma[0].data_fim, null);
  await assert.rejects(() => removerMatriculaProvisoriaService({ aluno_id: 2, matricula_id }), { statusCode: 404 });
  banco.matricula_turma[0].status = 'ATIVO';
  await assert.rejects(() => removerMatriculaProvisoriaService({ aluno_id: 1, matricula_id }), { statusCode: 409 });
});

test('aluno inativo não recebe atendimento nem oficina e provisórios não são removidos de aluno ativo', async (t) => {
  const banco = simularBanco(t);
  await matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] });
  banco.aluno[0].status = 'ATIVO';
  await assert.rejects(() => removerMatriculaProvisoriaService({ aluno_id: 1, matricula_id: banco.matricula_turma[0].id }), { statusCode: 409 });
  banco.aluno[0].status = 'INATIVO';
  await assert.rejects(() => agendarAtendimentoService(pedidoClinico), { statusCode: 404 });
  await assert.rejects(() => matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] }), { statusCode: 404 });
});

for (const controller of [removerMatriculaProvisoria, removerAtendimentoProvisorio]) {
  test(`controller ${controller.name} rejeita identificadores inválidos`, async (t) => {
    simularBanco(t);
    const res = { status(codigo) { this.statusCode = codigo; return this; }, json(body) { this.body = body; return this; } };
    await controller({ params: { aluno_id: 'invalido', matricula_id: '1', atendimento_id: '1' } }, res);
    assert.equal(res.statusCode, 400);
  });
}
