const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { editarAlunoService, criarAlunoService, obterAlunoService, obterOficinasService, obterAtendimentosService } = require('./alunoService');
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

const pessoaEdicao = { id: 1, nome: 'Aluno Teste', telefone: null, status_geral: 'INATIVO' };

function corresponde(registro, filtro = {}) {
  return Object.entries(filtro).every(([campo, esperado]) => {
    if (campo === 'OR') return esperado.some((item) => corresponde(registro, item));
    if (campo === 'AND') return esperado.every((item) => corresponde(registro, item));
    if (campo === 'is') return corresponde(registro, esperado);
    const atual = registro[campo];
    if (esperado === null || typeof esperado !== 'object') return atual === esperado;
    if ('not' in esperado) return atual != null && atual !== esperado.not;
    if ('notIn' in esperado) return !esperado.notIn.includes(atual);
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
      if (nome === 'aluno') return { ...item, responsaveis: ler('aluno_responsavel').filter((r) => r.aluno_id === item.id) };
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
          const item = { id: sequencia++, data_fim: null, data_cancelamento: null, ...valores };
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
        async updateMany({ where, data: valores }) {
          const itens = buscar(where);
          for (const item of itens) atualizados[nome].set(item.id, { ...atualizados[nome].get(item.id), ...valores });
          return { count: itens.length };
        },
        async upsert({ where, create, update }) {
          return buscar(where).length ? resultado[nome].update({ where, data: update }) : resultado[nome].create({ data: create });
        },
        async update({ where, data: valores }) {
          const item = buscar(where)[0];
          assert.ok(item);
          atualizados[nome].set(item.id, { ...atualizados[nome].get(item.id), ...valores });
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

for (const tipo of ['REGULAR', 'OFICINA']) {
  test(`${tipo}: matrícula provisória aguarda o bloqueio da turma e revalida seu status`, async (t) => {
    const banco = simularBanco(t, { turma: [turma(10, tipo)] });
    let liberar, sinalizar;
    const bloqueada = new Promise((resolve) => { sinalizar = resolve; });
    const continuar = new Promise((resolve) => { liberar = resolve; });
    const inativacao = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "turma" WHERE "id" = ${10} FOR UPDATE`;
      sinalizar();
      await continuar;
      await tx.turma.update({ where: { id: 10 }, data: { status: 'INATIVO' } });
    });
    await bloqueada;
    const matricula = tipo === 'REGULAR'
      ? matricularTurmaRegularService({ aluno_id: 1, turma_id: 10 })
      : matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] });
    const resultado = matricula.then(() => null, (erro) => erro);
    try {
      await new Promise(setImmediate);
      assert.equal(banco.matricula_turma.length, 0);
    } finally {
      liberar();
    }
    await inativacao;
    assert.ok(await resultado);
    assert.equal(banco.matricula_turma.length, 0);
  });
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
  test(`cancelamento provisório de ${tipo} preserva o registro e retira da agenda`, async (t) => {
    const banco = simularBanco(t, { turma: [turma(10, tipo)] });
    if (tipo === 'REGULAR') await matricularTurmaRegularService({ aluno_id: 1, turma_id: 10 });
    else await matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] });
    await removerMatriculaProvisoriaService({ aluno_id: 1, matricula_id: banco.matricula_turma[0].id });
    assert.equal(banco.matricula_turma.length, 1);
    assert.equal(banco.matricula_turma[0].status, 'PROVISORIO');
    assert.ok(banco.matricula_turma[0].data_fim);
    assert.equal((await obterAgendaAlunoService(1)).eventos.length, 0);
    assert.equal(banco.aluno[0].status, 'RASCUNHO');
  });
}

test('cancelamento provisório da recorrência preserva sessões e oculta somente o atendimento escolhido', async (t) => {
  const banco = simularBanco(t);
  const primeiro = await agendarAtendimentoService({ ...pedidoClinico, tipo_recorrencia: 'SEMANAL', frequencia: 1,
    dias_semana: [1], data_termino: '2026-11-16' });
  const outro = await agendarAtendimentoService({ ...pedidoClinico, hora_inicio: '11:00' });
  assert.equal(banco.atendimento_sessao.length, 4);
  await removerAtendimentoProvisorioService({ aluno_id: 1, atendimento_id: primeiro.id });
  assert.equal(banco.atendimento_clinico.length, 2);
  assert.ok(banco.atendimento_clinico.find((a) => a.id === primeiro.id).data_cancelamento);
  assert.equal(banco.atendimento_sessao.length, 4);
  assert.deepEqual((await obterAtendimentosService(1)).map((a) => a.id), [outro.id]);
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

test('edição parcial preserva campos omitidos e permite limpar telefone', async (t) => {
  const banco = simularBanco(t, { pessoa: [{ ...pessoaEdicao, telefone: '51999999999' }], aluno: [{ ...aluno(1), participa_procan: true }] });
  await editarAlunoService(1, { nome: 'Novo Nome', telefone: null });
  assert.equal(banco.pessoa[0].nome, 'Novo Nome');
  assert.equal(banco.pessoa[0].telefone, null);
  assert.equal(banco.aluno[0].participa_procan, true);
});

test('aluno ativo não pode alterar status; rascunho pode ser ativado sem turma', async (t) => {
  const banco = simularBanco(t, { pessoa: [pessoaEdicao] });
  await assert.rejects(() => editarAlunoService(2, { status: 'RASCUNHO' }), { statusCode: 400 });
  await editarAlunoService(1, { status: 'ATIVO' });
  assert.equal(banco.aluno[0].status, 'ATIVO');
  assert.equal(banco.pessoa[0].status_geral, 'ATIVO');
  assert.equal(banco.matricula_turma.length, 0);
});

test('redução de frequência informa oficinas e clínica sem gravar nem cancelar', async (t) => {
  const banco = simularBanco(t, { pessoa: [pessoaEdicao] });
  await matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] });
  await agendarAtendimentoService({ ...pedidoClinico, hora_inicio: '11:00' });
  await assert.rejects(() => editarAlunoService(1, { nome: 'Não salvar', dias_frequencia: [2] }), (erro) => {
    assert.equal(erro.isConflict, true); assert.equal(erro.detalhes.length, 2); return true;
  });
  assert.equal(banco.pessoa[0].nome, pessoaEdicao.nome);
  assert.equal(banco.matricula_turma[0].data_fim, null);
  assert.equal(banco.atendimento_clinico[0].data_cancelamento, null);
  await editarAlunoService(1, { dias_frequencia: [1,2,3,4,5,6] });
  assert.ok(banco.aluno[0].dias_frequencia.includes(6));
});

test('troca de período exige confirmação atualizada e preserva provisórios encerrados', async (t) => {
  const banco = simularBanco(t, { pessoa: [pessoaEdicao] });
  await matricularTurmaRegularService({ aluno_id: 1, turma_id: 20 });
  let confirmacao;
  await assert.rejects(() => editarAlunoService(1, { turno: 'TARDE' }), (erro) => { confirmacao = erro.confirmacao; return !!confirmacao; });
  await agendarAtendimentoService(pedidoClinico);
  await assert.rejects(() => editarAlunoService(1, { turno: 'TARDE', confirmar_cancelamentos: confirmacao }), (erro) => {
    confirmacao = erro.confirmacao; return confirmacao.atendimentos.length === 1;
  });
  await editarAlunoService(1, { turno: 'TARDE', confirmar_cancelamentos: confirmacao });
  assert.equal(banco.aluno[0].turno, 'TARDE');
  assert.equal(banco.matricula_turma[0].status, 'PROVISORIO');
  assert.ok(banco.matricula_turma[0].data_fim);
  assert.equal(banco.atendimento_clinico[0].status, 'PROVISORIO');
  assert.ok(banco.atendimento_clinico[0].data_cancelamento);
  assert.equal((await obterAgendaAlunoService(1)).eventos.length, 0);
  await editarAlunoService(1, { status: 'ATIVO' });
  assert.equal(banco.matricula_turma[0].status, 'PROVISORIO');
  assert.equal(banco.atendimento_clinico[0].status, 'PROVISORIO');
});

for (const tipo of ['REGULAR', 'OFICINA']) {
  test(`ativação revalida vagas de ${tipo} e não promove parcialmente`, async (t) => {
    const banco = simularBanco(t, { pessoa: [pessoaEdicao], turma: [turma(10, tipo)] });
    const matricular = aluno_id => tipo === 'REGULAR' ? matricularTurmaRegularService({ aluno_id, turma_id: 10 }) : matricularOficinasService({ aluno_id, oficinas_ids: [10] });
    await matricular(1); await matricular(2);
    await assert.rejects(() => editarAlunoService(1, { status: 'ATIVO', nome: 'Não salvar' }), { isConflict: true });
    assert.equal(banco.aluno[0].status, 'RASCUNHO');
    assert.equal(banco.pessoa[0].nome, pessoaEdicao.nome);
    assert.equal(banco.matricula_turma[0].status, 'PROVISORIO');
  });
}

test('ativação promove turma, oficina, atendimento e sessões em uma transação', async (t) => {
  const banco = simularBanco(t, { pessoa: [pessoaEdicao], turma: [turma(10, 'OFICINA', 5), turma(20, 'REGULAR', 5)] });
  await matricularTurmaRegularService({ aluno_id: 1, turma_id: 20 });
  await matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] });
  await agendarAtendimentoService({ ...pedidoClinico, hora_inicio: '11:00' });
  await editarAlunoService(1, { status: 'ATIVO' });
  assert.equal(banco.aluno[0].status, 'ATIVO');
  assert.ok(banco.matricula_turma.every((m) => m.status === 'ATIVO'));
  assert.ok(banco.atendimento_clinico.every((a) => a.status === 'ATIVO'));
  assert.ok(banco.atendimento_sessao.every((s) => s.status === 'ATIVO'));
});

test('troca de turma regular encerra a antiga, mantém oficina e valida a nova antes do commit', async (t) => {
  const banco = simularBanco(t, { pessoa: [pessoaEdicao], turma: [turma(10), turma(20, 'REGULAR'), turma(21, 'REGULAR', 0)] });
  await matricularTurmaRegularService({ aluno_id: 1, turma_id: 20 });
  await matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] });
  await editarAlunoService(1, { turma_id: 21 });
  assert.equal(banco.matricula_turma[0].status, 'PROVISORIO');
  assert.ok(banco.matricula_turma[0].data_fim);
  assert.equal(banco.matricula_turma[1].data_fim, null);
  assert.equal(banco.matricula_turma[2].turma_id, 21);
  await assert.rejects(() => editarAlunoService(1, { status: 'ATIVO' }), { isConflict: true });
  assert.equal(banco.aluno[0].status, 'RASCUNHO');
});

test('ativação revalida conflitos clínicos e frequência com rollback', async (t) => {
  const banco = simularBanco(t, { pessoa: [pessoaEdicao] });
  await agendarAtendimentoService(pedidoClinico);
  banco.atendimento_sessao.push({ ...banco.atendimento_sessao[0], id: 999 });
  await assert.rejects(() => editarAlunoService(1, { status: 'ATIVO' }), { isConflict: true });
  assert.equal(banco.aluno[0].status, 'RASCUNHO');
  assert.equal(banco.atendimento_clinico[0].status, 'PROVISORIO');
});

test('troca de período ativo encerra vínculos, preserva sessões iniciadas e histórico', async (t) => {
  const banco = simularBanco(t, { pessoa: [{ ...pessoaEdicao, id: 2 }], turma: [turma(10, 'OFICINA', 5), turma(20, 'REGULAR', 5)] });
  await matricularTurmaRegularService({ aluno_id: 2, turma_id: 20 });
  await matricularOficinasService({ aluno_id: 2, oficinas_ids: [10] });
  await agendarAtendimentoService({ ...pedidoClinico, aluno_id: 2, hora_inicio: '11:00', tipo_recorrencia: 'SEMANAL', frequencia: 1, dias_semana: [1], data_termino: '2026-11-16' });
  // A primeira sessão está em andamento; as próximas ainda não começaram.
  t.mock.timers.setTime(new Date('2026-11-02T14:15:00.000Z').getTime());
  let confirmar_cancelamentos;
  await assert.rejects(() => editarAlunoService(2, { turno: 'TARDE' }), (e) => { confirmar_cancelamentos = e.confirmacao; return !!confirmar_cancelamentos; });
  await editarAlunoService(2, { turno: 'TARDE', confirmar_cancelamentos });
  assert.ok(banco.matricula_turma.every((m) => m.status === 'INATIVO' && m.data_fim.toISOString().slice(0,10) === '2026-11-02'));
  assert.equal(banco.atendimento_clinico[0].status, 'INATIVO');
  assert.equal(banco.atendimento_clinico[0].data_termino.toISOString().slice(0,10), '2026-11-02');
  assert.equal(banco.atendimento_sessao[0].status, 'ATIVO');
  assert.ok(banco.atendimento_sessao.slice(1).every((s) => s.status === 'INATIVO'));
  const agenda = await obterAgendaAlunoService(2);
  assert.ok(agenda.eventos.some((e) => e.tipo === 'ATENDIMENTO'));
  assert.ok(agenda.eventos.some((e) => e.tipo === 'REGULAR'));
  assert.equal((await obterAgendaAlunoService(2, '2026-11-09')).eventos.length, 0);
});

test('ativações concorrentes de rascunhos disputam a última vaga sob bloqueio da turma', async (t) => {
  const banco = simularBanco(t, { pessoa: [pessoaEdicao, { ...pessoaEdicao, id: 2 }], aluno: [aluno(1), aluno(2)], turma: [turma(20, 'REGULAR')] });
  await matricularTurmaRegularService({ aluno_id: 1, turma_id: 20 });
  await matricularTurmaRegularService({ aluno_id: 2, turma_id: 20 });
  const respostas = await Promise.allSettled([editarAlunoService(1, { status: 'ATIVO' }), editarAlunoService(2, { status: 'ATIVO' })]);
  assert.equal(respostas.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(respostas.find((r) => r.status === 'rejected').reason.isConflict, true);
  assert.equal(banco.matricula_turma.filter((m) => m.status === 'ATIVO').length, 1);
});

test('edição atualiza responsáveis existentes, adiciona novos e salva dados médicos', async (t) => {
  const banco = simularBanco(t, { pessoa: [pessoaEdicao, { id: 4, nome: 'Responsável', telefone: null }],
    aluno_responsavel: [{ id: 9, aluno_id: 1, pessoa_id: 4, parentesco: null }] });
  await editarAlunoService(1, { responsaveis: [{ id: 9, nome: 'Responsável Editado', parentesco: 'Mãe', telefone: '51999999999' }, { nome: 'Novo Responsável' }],
    dados_medicos: { usa_medicamento: true, medicamentos_descricao: 'Medicamento teste', autorizado_atividade_fisica: false } });
  assert.equal(banco.pessoa.find((p) => p.id === 4).nome, 'Responsável Editado');
  assert.equal(banco.aluno_responsavel.length, 2);
  assert.equal(banco.aluno_dados_medicos[0].medicamentos_descricao, 'Medicamento teste');
  await editarAlunoService(1, { responsaveis: [], dados_medicos: null });
  assert.equal(banco.aluno_responsavel.length, 0);
  assert.equal(banco.aluno_dados_medicos.length, 0);
  assert.ok(banco.pessoa.some((p) => p.id === 4));
});

test('PATCH de aluno exige administração, valida DTO e retorna o detalhe atualizado', async (t) => {
  const express = require('express');
  const { createServer } = require('node:http');
  const { alunoAdminRoutes } = require('../routes/alunoRoutes');
  const banco = simularBanco(t, { pessoa: [pessoaEdicao] });
  prisma.aluno.findUnique = async ({ where }) => ({ ...banco.aluno.find((a) => a.id === where.id), pessoa: banco.pessoa[0],
    responsaveis: [], dados_medicos: null, matriculas_turmas: [] });
  const app = express(); app.use(express.json());
  app.use('/api', (req, res, next) => { if (req.get('x-test-role')) req.usuario = { role: req.get('x-test-role') }; next(); }, alunoAdminRoutes);
  const server = createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  for (const [role, body, esperado] of [[null, { nome: 'Novo Nome' }, 401], ['professor', { nome: 'Novo Nome' }, 403],
    ['admin', {}, 400], ['admin', { status: 'INATIVO' }, 400], ['admin', { data_nascimento: '2026-02-30' }, 400],
    ['admin', { status: 'ATIVO', nome: 'Aluno Sem Turma' }, 200]]) {
    const resposta = await fetch(`http://127.0.0.1:${server.address().port}/api/alunos/1`, { method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, body: JSON.stringify(body) });
    assert.equal(resposta.status, esperado);
    if (esperado === 200) {
      const dados = await resposta.json(); assert.equal(dados.pessoa.nome, 'Aluno Sem Turma'); assert.equal(dados.status, 'ATIVO');
    }
  }
});

for (const tipo of ['REGULAR', 'OFICINA']) {
  test(`${tipo}: provisório não tem início efetivo e recebe a data de Brasília na ativação`, async (t) => {
    const banco = simularBanco(t, { pessoa: [pessoaEdicao], turma: [turma(10, tipo, 5)] });
    if (tipo === 'REGULAR') await matricularTurmaRegularService({ aluno_id: 1, turma_id: 10 });
    else await matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] });
    assert.equal(banco.matricula_turma[0].data_inicio, null);
    t.mock.timers.setTime(new Date('2026-11-16T01:30:00.000Z').getTime());
    await editarAlunoService(1, { status: 'ATIVO' });
    assert.deepEqual(banco.matricula_turma[0].data_inicio, data('2026-11-15'));
    assert.equal(banco.matricula_turma[0].status, 'ATIVO');
    assert.equal((await obterAgendaAlunoService(1, '2026-11-02')).eventos.length, 0);
    const [turmaAtual] = await listarTurmasService(tipo);
    assert.equal(turmaAtual.vagas_ocupadas, 1);
  });
}

test('ativação substitui início antigo do provisório e preserva matrículas já efetivas e encerradas', async (t) => {
  const banco = simularBanco(t, { pessoa: [pessoaEdicao], turma: [turma(10), turma(20, 'REGULAR'), turma(21, 'REGULAR')] });
  await matricularTurmaRegularService({ aluno_id: 1, turma_id: 20 });
  banco.matricula_turma[0].data_inicio = data('2026-10-28');
  banco.matricula_turma.push({ id: 998, aluno_id: 1, turma_id: 10, status: 'ATIVO', data_inicio: data('2026-10-01'), data_fim: null },
    { id: 999, aluno_id: 1, turma_id: 21, status: 'PROVISORIO', data_inicio: data('2026-10-01'), data_fim: data('2026-10-10') });
  t.mock.timers.setTime(new Date('2026-11-15T16:00:00.000Z').getTime());
  await editarAlunoService(1, { status: 'ATIVO' });
  assert.deepEqual(banco.matricula_turma[0].data_inicio, data('2026-11-15'));
  assert.deepEqual(banco.matricula_turma.find((m) => m.id === 998).data_inicio, data('2026-10-01'));
  assert.deepEqual(banco.matricula_turma.find((m) => m.id === 999).data_inicio, data('2026-10-01'));
  assert.equal(banco.matricula_turma.find((m) => m.id === 999).status, 'PROVISORIO');
});

for (const tipo_recorrencia of ['SEMANAL', 'MENSAL']) {
  test(`${tipo_recorrencia}: mantém início planejado e promove somente sessões futuras, sem deslocar a recorrência`, async (t) => {
    const banco = simularBanco(t, { pessoa: [pessoaEdicao] });
    await agendarAtendimentoService({ ...pedidoClinico, tipo_recorrencia, frequencia: tipo_recorrencia === 'SEMANAL' ? 2 : 1,
      dias_semana: [1], data_termino: '2026-12-02' });
    const datas = banco.atendimento_sessao.map((s) => s.data_sessao.toISOString());
    t.mock.timers.setTime(new Date('2026-11-15T16:00:00.000Z').getTime());
    await editarAlunoService(1, { status: 'ATIVO' });
    assert.equal(banco.atendimento_clinico[0].status, 'ATIVO');
    assert.deepEqual(banco.atendimento_clinico[0].data_inicio, data('2026-11-02'));
    assert.deepEqual(banco.atendimento_sessao.map((s) => s.data_sessao.toISOString()), datas);
    assert.equal(banco.atendimento_sessao[0].status, 'PROVISORIO');
    assert.ok(banco.atendimento_sessao.slice(1).every((s) => s.status === 'ATIVO'));
    assert.equal((await obterAgendaAlunoService(1, '2026-11-02')).eventos.length, 0);
    assert.ok((await obterAgendaAlunoService(1, tipo_recorrencia === 'SEMANAL' ? '2026-11-16' : '2026-12-02')).eventos.length);
  });
}

for (const [instante, esperado] of [['2026-11-02T12:29:59.000Z', 'ATIVO'], ['2026-11-02T12:30:00.000Z', 'ATIVO'],
  ['2026-11-02T12:30:01.000Z', 'PROVISORIO'], ['2026-11-02T12:45:00.000Z', 'PROVISORIO'], ['2026-11-15T16:00:00.000Z', 'PROVISORIO']]) {
  test(`eventual às 09:30 em Brasília, ativação ${instante}: ${esperado}`, async (t) => {
    const banco = simularBanco(t, { pessoa: [pessoaEdicao] });
    await agendarAtendimentoService(pedidoClinico);
    t.mock.timers.setTime(new Date(instante).getTime());
    await editarAlunoService(1, { status: 'ATIVO' });
    assert.equal(banco.aluno[0].status, 'ATIVO');
    assert.equal(banco.pessoa[0].status_geral, 'ATIVO');
    assert.equal(banco.atendimento_clinico[0].status, esperado);
    assert.equal(banco.atendimento_sessao[0].status, esperado);
    if (esperado === 'PROVISORIO') assert.equal((await obterAgendaAlunoService(1, '2026-11-02')).eventos.length, 0);
  });
}

test('recorrência inteiramente passada não impede ativação e não vira histórico efetivo', async (t) => {
  const banco = simularBanco(t, { pessoa: [pessoaEdicao] });
  await agendarAtendimentoService({ ...pedidoClinico, tipo_recorrencia: 'SEMANAL', frequencia: 1, dias_semana: [1], data_termino: '2026-11-09' });
  t.mock.timers.setTime(new Date('2026-11-15T16:00:00.000Z').getTime());
  await editarAlunoService(1, { status: 'ATIVO', dias_frequencia: [2] });
  assert.equal(banco.aluno[0].status, 'ATIVO');
  assert.equal(banco.atendimento_clinico[0].status, 'PROVISORIO');
  assert.ok(banco.atendimento_sessao.every((s) => s.status === 'PROVISORIO'));
  assert.equal((await obterAgendaAlunoService(1, '2026-11-02')).eventos.length, 0);
});

test('sessão provisória em andamento não bloqueia ativação com novos dias de frequência', async (t) => {
  const banco = simularBanco(t, { pessoa: [pessoaEdicao] });
  await agendarAtendimentoService(pedidoClinico);
  t.mock.timers.setTime(new Date('2026-11-02T12:45:00.000Z').getTime());
  await editarAlunoService(1, { status: 'ATIVO', dias_frequencia: [2] });
  assert.equal(banco.aluno[0].status, 'ATIVO');
  assert.equal(banco.atendimento_sessao[0].status, 'PROVISORIO');
});

test('conflitos de sessões elegíveis impedem promoção e datas efetivas sem alterações parciais', async (t) => {
  const banco = simularBanco(t, { pessoa: [pessoaEdicao], turma: [turma(20, 'REGULAR', 5)] });
  await matricularTurmaRegularService({ aluno_id: 1, turma_id: 20 });
  await agendarAtendimentoService({ ...pedidoClinico, tipo_recorrencia: 'SEMANAL', frequencia: 1, dias_semana: [1], data_termino: '2026-11-16' });
  const futura = banco.atendimento_sessao.at(-1);
  banco.atendimento_sessao.push({ ...futura, id: 999 });
  t.mock.timers.setTime(new Date('2026-11-15T16:00:00.000Z').getTime());
  await assert.rejects(() => editarAlunoService(1, { status: 'ATIVO' }), { isConflict: true });
  assert.equal(banco.aluno[0].status, 'RASCUNHO');
  assert.equal(banco.pessoa[0].status_geral, 'INATIVO');
  assert.equal(banco.matricula_turma[0].data_inicio, null);
  assert.equal(banco.matricula_turma[0].status, 'PROVISORIO');
  assert.equal(banco.atendimento_clinico[0].status, 'PROVISORIO');
  assert.ok(banco.atendimento_sessao.every((s) => s.status === 'PROVISORIO'));
});
