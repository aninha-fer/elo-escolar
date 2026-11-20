const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { editarAlunoService, criarAlunoService, listarAlunosService, obterAlunoService, obterOficinasService, obterAtendimentosService, alterarStatusAlunoService, excluirAlunoService } = require('./alunoService');
const { criarOcorrenciaService, listarOcorrenciasService, editarOcorrenciaService, excluirOcorrenciaService } = require('./ocorrenciaService');
const { matricularOficinasService, matricularTurmaRegularService, removerMatriculaProvisoriaService, cancelarOficinaService } = require('./matriculaService');
const { agendarAtendimentoService, removerAtendimentoProvisorioService, editarAtendimentoService, cancelarAtendimentoService, obterAtendimentoService } = require('./atendimentoService');
const { obterAgendaAlunoService } = require('./agendaService');
const { editarTurmaService, listarTurmasService, listarTurmasRegularesPorTurnoService, excluirTurmaService, obterTurmaService } = require('./turmaService');
const { removerMatriculaProvisoria } = require('../controllers/matriculaController');
const { removerAtendimentoProvisorio } = require('../controllers/atendimentoController');
const { editarProfissionalService, excluirProfissionalService, listarProfissionaisService } = require('./profissionalService');
const { criarTurmaService } = require('./turmaService');
const { criarUsuario, editarUsuario, listarUsuarios, excluirUsuario } = require('./usuarioService');
const { buscarIdentidadePorId } = require('./authService');
const { prepararNovaTurmaService, criarTurmaAPartirService } = require('./turmaService');
const { criarAnoLetivoService, editarAnoLetivoService } = require('./anoLetivoService');
const { sincronizarTurmasExpiradas } = require('./encerramentoTurmaService');

const data = (valor) => new Date(`${valor}T00:00:00.000Z`);
const hora = (valor) => new Date(`1970-01-01T${valor}:00.000Z`);

test('Home mostra somente regulares ativas do ano solicitado, inclusive antes do período letivo', async (t) => {
  simularBanco(t, { turma: [turma(20, 'REGULAR'), { ...turma(30, 'REGULAR'), ano_letivo_id: 2027 },
    { ...turma(40, 'REGULAR'), status: 'INATIVO' }, { ...turma(50, 'REGULAR'), deleted_at: new Date() }, turma(60)] });
  t.mock.timers.setTime(new Date('2026-01-03T12:00:00Z').getTime());
  assert.deepEqual((await listarTurmasService('REGULAR', null, { status: 'ATIVO', ano: 2026 })).map((t) => t.id), [20]);
  assert.deepEqual(await listarTurmasService('REGULAR', null, { status: 'ATIVO', ano: 2028 }), []);
  assert.equal((await listarTurmasService('REGULAR')).length, 3);
});

test('calendário da Home recebe todas as oficinas ativas nas férias, sem limitar a vinte registros', async (t) => {
  simularBanco(t, { turma: [
    ...Array.from({ length: 25 }, (_, i) => turma(i + 10)),
    { ...turma(60), status: 'INATIVO' }, { ...turma(70), deleted_at: new Date() }, turma(80, 'REGULAR'),
  ] });
  t.mock.timers.setTime(new Date('2026-01-03T12:00:00Z').getTime());
  const oficinas = await listarTurmasService('OFICINA', null, { status: 'ATIVO' });
  assert.equal(oficinas.length, 25);
  assert.ok(oficinas.every((o) => o.status === 'ATIVO' && o.tipo === 'OFICINA'));
  assert.equal((await listarTurmasService('OFICINA')).length, 26);
});

function calendarioTeste(id, inicio, fim) {
  return { id, ano: id, data_inicio: data(inicio), data_fim: data(fim), created_at: new Date('2026-01-01T12:00:00Z'), updated_at: new Date('2026-01-01T12:00:00Z') };
}

function planejamentoExpirado() {
  const inicial = planejamentoParaStatus();
  inicial.ano_letivo = [calendarioTeste(2026, '2026-02-03', '2026-11-01'), calendarioTeste(2027, '2027-02-08', '2027-12-18')];
  inicial.turma[0].capacidade_maxima = 10;
  return inicial;
}

test('expiração tardia encerra somente regular e preserva oficinas, clínicas e histórico escolar', async (t) => {
  const banco = simularBanco(t, planejamentoExpirado());
  const outras = structuredClone({ oficina: banco.matricula_turma[1], clinicas: banco.atendimento_clinico, sessoes: banco.atendimento_sessao });
  t.mock.timers.setTime(new Date('2027-01-10T15:00:00Z').getTime());
  await sincronizarTurmasExpiradas();
  assert.equal(banco.turma[0].status, 'INATIVO');
  assert.equal(banco.turma[1].status, 'ATIVO');
  assert.equal(banco.matricula_turma[0].status, 'INATIVO');
  assert.deepEqual(banco.matricula_turma[0].data_fim, data('2026-11-01'));
  assert.deepEqual({ oficina: banco.matricula_turma[1], clinicas: banco.atendimento_clinico, sessoes: banco.atendimento_sessao }, outras);
  assert.ok((await obterAgendaAlunoService(1, '2026-10-26')).eventos.some((e) => e.tipo === 'REGULAR'));
  const antes = structuredClone(banco), transacoes = prisma.$transaction.mock.callCount();
  await sincronizarTurmasExpiradas();
  assert.equal(prisma.$transaction.mock.callCount(), transacoes);
  assert.deepEqual(banco, antes);
});

test('expiração respeita status e datas de todos os vínculos, inclusive cancelamento antes do início', async (t) => {
  const inicial = planejamentoExpirado();
  inicial.matricula_turma = [
    { id: 1, aluno_id: 1, turma_id: 10, status: 'ATIVO', data_inicio: data('2026-03-01'), data_fim: data('2026-10-01') },
    { id: 2, aluno_id: 1, turma_id: 10, status: 'PROVISORIO', data_inicio: null, data_fim: null },
    { id: 3, aluno_id: 1, turma_id: 10, status: 'INATIVO', data_inicio: data('2026-03-01'), data_fim: null },
    { id: 4, aluno_id: 1, turma_id: 10, status: 'INATIVO', data_inicio: data('2026-03-01'), data_fim: data('2026-09-01') },
    { id: 5, aluno_id: 1, turma_id: 10, status: 'ATIVO', data_inicio: data('2027-01-10'), data_fim: null },
    { id: 6, aluno_id: 1, turma_id: 10, status: 'PROVISORIO', data_inicio: null, data_fim: data('2026-10-01') },
  ];
  const banco = simularBanco(t, inicial), historico = structuredClone(banco.matricula_turma[3]);
  await sincronizarTurmasExpiradas();
  assert.deepEqual(banco.matricula_turma.map((m) => [m.status, m.data_fim.toISOString().slice(0, 10)]), [
    ['INATIVO', '2026-10-01'], ['PROVISORIO', '2026-11-01'], ['INATIVO', '2026-11-01'],
    ['INATIVO', '2026-09-01'], ['INATIVO', '2026-11-01'], ['PROVISORIO', '2026-10-01'],
  ]);
  assert.deepEqual(banco.matricula_turma[3], historico);
  assert.deepEqual(banco.matricula_turma[4].data_inicio, data('2027-01-10'));
  assert.equal((await obterAgendaAlunoService(1, '2027-01-11')).eventos.some((e) => e.tipo === 'REGULAR'), false);
});

test('expiração ignora oficina, regular futura, inativa e excluída; encerra regular sem matrículas', async (t) => {
  const inicial = planejamentoExpirado();
  inicial.turma.push({ ...turma(30, 'REGULAR'), ano_letivo_id: 2027 }, { ...turma(31, 'REGULAR'), status: 'INATIVO' },
    { ...turma(32, 'REGULAR'), deleted_at: new Date() }, turma(33, 'REGULAR'));
  const banco = simularBanco(t, inicial), originais = structuredClone(banco.turma.slice(1,5));
  await sincronizarTurmasExpiradas();
  assert.deepEqual(banco.turma.slice(1,5), originais);
  assert.equal(banco.turma.at(-1).status, 'INATIVO');
});

test('sincronizações simultâneas encerram uma só vez e não exigem confirmação', async (t) => {
  const banco = simularBanco(t, planejamentoExpirado());
  await Promise.all([sincronizarTurmasExpiradas(), sincronizarTurmasExpiradas()]);
  assert.equal(banco.turma[0].status, 'INATIVO');
  assert.equal(banco.matricula_turma[0].status, 'INATIVO');
  assert.deepEqual(banco.matricula_turma[0].data_fim, data('2026-11-01'));
});

test('falha ao inativar turma desfaz os encerramentos da mesma transação', async (t) => {
  const banco = simularBanco(t, planejamentoExpirado()), antes = structuredClone(banco), original = prisma.$transaction;
  prisma.$transaction = (callback, options) => original(async (tx) => {
    tx.turma.update = async () => { throw new Error('Falha simulada no encerramento'); };
    return callback(tx);
  }, options);
  await assert.rejects(() => sincronizarTurmasExpiradas(), /Falha simulada/);
  assert.deepEqual(banco, antes);
});

test('regular expirada não pode ser reativada, mas continua editável', async (t) => {
  const banco = simularBanco(t, planejamentoExpirado());
  await assert.rejects(() => editarTurmaService(10, { status: 'ATIVO' }), { statusCode: 409 });
  assert.equal(banco.turma[0].status, 'INATIVO');
  const editada = await editarTurmaService(10, { nome: 'Nome revisado' });
  assert.equal(editada.nome, 'Nome revisado');
  assert.equal(editada.status, 'INATIVO');
  assert.equal(editada.expirada, true);
  assert.equal((await obterTurmaService(10)).expirada, true);
});

test('matrícula no próximo ano encerra vínculo expirado antes de validar unicidade', async (t) => {
  const inicial = planejamentoExpirado();
  inicial.turma.push({ ...turma(30, 'REGULAR', 10), ano_letivo_id: 2027 });
  const banco = simularBanco(t, inicial);
  assert.equal((await obterAlunoService(1)).turma_regular, null);
  const nova = await matricularTurmaRegularService({ aluno_id: 1, turma_id: 30 });
  assert.equal(banco.turma[0].status, 'INATIVO');
  assert.equal(nova.status, 'ATIVO');
  assert.deepEqual(nova.data_inicio, data('2027-02-08'));
  assert.equal((await obterAlunoService(1)).turma_regular.id, 30);
});

test('escopo por aluno não encerra turmas expiradas sem relação com ele', async (t) => {
  const inicial = planejamentoExpirado(); inicial.turma.push(turma(30, 'REGULAR'));
  const banco = simularBanco(t, inicial);
  await sincronizarTurmasExpiradas({ alunoIds: [1] });
  assert.equal(banco.turma[0].status, 'INATIVO');
  assert.equal(banco.turma.at(-1).status, 'ATIVO');
});

test('origem expirada é encerrada antes da preparação e cancelamento anterior ao início não recebe ano anterior', async (t) => {
  const inicial = planejamentoExpirado();
  inicial.matricula_turma[0].data_inicio = data('2027-01-10');
  const banco = simularBanco(t, inicial);
  const preparacao = await prepararNovaTurmaService(10);
  assert.equal(preparacao.origem.status, 'INATIVO');
  assert.equal(preparacao.origem.expirada, true);
  assert.equal(preparacao.alunos.find((a) => a.id === 1).ano_anterior, false);
  assert.deepEqual(banco.matricula_turma[0].data_inicio, data('2027-01-10'));
});

test('inativação manual concorrente com expiração preserva o término letivo', async (t) => {
  const banco = simularBanco(t, planejamentoExpirado());
  const resultados = await Promise.allSettled([
    sincronizarTurmasExpiradas(), editarTurmaService(10, { status: 'INATIVO', confirmar_cancelamentos: { matriculas: [1], matriculas_ativas: 1 } }),
  ]);
  assert.equal(resultados[0].status, 'fulfilled');
  if (resultados[1].status === 'rejected') assert.equal(resultados[1].reason.statusCode, 409);
  assert.equal(banco.turma[0].status, 'INATIVO');
  assert.equal(banco.matricula_turma[0].status, 'INATIVO');
  assert.deepEqual(banco.matricula_turma[0].data_fim, data('2026-11-01'));
});

test('matrícula concorrente em turma expirada é impedida enquanto a sincronização encerra vínculos', async (t) => {
  const banco = simularBanco(t, planejamentoExpirado());
  const antes = banco.matricula_turma.length;
  const resultados = await Promise.allSettled([
    sincronizarTurmasExpiradas(), matricularTurmaRegularService({ aluno_id: 2, turma_id: 10 }),
  ]);
  assert.equal(resultados[0].status, 'fulfilled');
  assert.equal(resultados[1].status, 'rejected');
  assert.equal(banco.matricula_turma.length, antes);
  assert.equal(banco.turma[0].status, 'INATIVO');
});

test('releitura dentro da transação respeita calendário atualizado após a identificação', async (t) => {
  const banco = simularBanco(t, planejamentoExpirado()), original = prisma.$transaction;
  prisma.$transaction = (callback, options) => {
    banco.ano_letivo[0].data_fim = data('2026-12-19');
    return original(callback, options);
  };
  await sincronizarTurmasExpiradas();
  assert.equal(banco.turma[0].status, 'ATIVO');
  assert.equal(banco.matricula_turma[0].data_fim, null);
});

test('vínculo detectado depois dos bloqueios repete a transação sem confirmação', async (t) => {
  const inicial = planejamentoExpirado();
  inicial.matricula_turma.push({ id: 3, aluno_id: 2, turma_id: 10, status: 'ATIVO', data_inicio: data('2026-10-01'), data_fim: null });
  const banco = simularBanco(t, inicial), original = prisma.$transaction;
  let transacoes = 0;
  prisma.$transaction = (callback, options) => original(async (tx) => {
    transacoes++;
    if (transacoes === 1) {
      const consultar = tx.matricula_turma.findMany;
      let leituras = 0;
      tx.matricula_turma.findMany = async (params) => {
        const registros = await consultar(params);
        return ++leituras === 1 ? registros.filter((m) => m.aluno_id !== 2) : registros;
      };
    }
    return callback(tx);
  }, options);
  await sincronizarTurmasExpiradas();
  assert.equal(transacoes, 2);
  assert.equal(banco.turma[0].status, 'INATIVO');
  assert.ok(banco.matricula_turma.filter((m) => m.turma_id === 10).every((m) => m.status === 'INATIVO' && +m.data_fim === +data('2026-11-01')));
});

async function confirmarTermino(id, dados) {
  let confirmacao;
  await assert.rejects(() => editarAnoLetivoService(id, dados), (erro) => { confirmacao = erro.confirmacao; return erro.statusCode === 409 && Boolean(confirmacao); });
  return editarAnoLetivoService(id, { ...dados, confirmar_alteracao_fim: confirmacao });
}

test('antecipar início futuro reajusta quem aguardava calendário, preserva ingresso posterior, encerrados e provisórios', async (t) => {
  const banco = simularBanco(t, {
    ano_letivo: [calendarioTeste(2027, '2027-02-08', '2027-12-18')], turma: [{ ...turma(20, 'REGULAR', 10), ano_letivo_id: 2027 }],
    matricula_turma: [
      { id: 1, aluno_id: 1, turma_id: 20, status: 'ATIVO', data_inicio: data('2027-02-08'), data_fim: null },
      { id: 2, aluno_id: 2, turma_id: 20, status: 'ATIVO', data_inicio: data('2027-03-01'), data_fim: null },
      { id: 3, aluno_id: 3, turma_id: 20, status: 'PROVISORIO', data_inicio: null, data_fim: null },
      { id: 4, aluno_id: 1, turma_id: 20, status: 'INATIVO', data_inicio: data('2026-02-03'), data_fim: data('2026-05-01') },
    ],
  });
  const historico = structuredClone(banco.matricula_turma.slice(1));
  await editarAnoLetivoService(2027, { data_inicio: '2027-02-01' });
  assert.deepEqual(banco.matricula_turma[0].data_inicio, data('2027-02-01'));
  assert.deepEqual(banco.matricula_turma.slice(1), historico);
  await editarAnoLetivoService(2027, { data_inicio: '2027-03-02' });
  assert.deepEqual(banco.matricula_turma[0].data_inicio, data('2027-03-02'));
  assert.deepEqual(banco.matricula_turma[1].data_inicio, data('2027-03-02'));
});

test('alterar término exige confirmação atual e preserva matrículas, turmas e todas as sessões clínicas', async (t) => {
  const inicial = planejamentoParaStatus();
  inicial.ano_letivo = [calendarioTeste(2026, '2026-02-03', '2026-12-19')];
  const banco = simularBanco(t, inicial);
  const antes = structuredClone({ matriculas: banco.matricula_turma, atendimentos: banco.atendimento_clinico, sessoes: banco.atendimento_sessao, turmas: banco.turma });
  await confirmarTermino(2026, { data_fim: '2026-12-18' });
  assert.deepEqual({ matriculas: banco.matricula_turma, atendimentos: banco.atendimento_clinico, sessoes: banco.atendimento_sessao, turmas: banco.turma }, antes);
});

for (const status of ['ATIVO', 'PROVISORIO']) {
  test(`ampliar calendário bloqueia conflito de oficina com atendimento ${status} sem nenhuma gravação`, async (t) => {
    const inicial = {
      ano_letivo: [calendarioTeste(2026, '2026-02-03', '2026-12-19')],
      aluno: [aluno(1, status === 'PROVISORIO' ? 'RASCUNHO' : 'ATIVO')], pessoa: [{ id: 1, nome: 'Aluno' }],
      turma: [turma(10)],
      matricula_turma: [{ id: 1, aluno_id: 1, turma_id: 10, status, data_inicio: status === 'ATIVO' ? data('2026-11-01') : null, data_fim: null }],
      atendimento_clinico: [{ id: 60, aluno_id: 1, profissional_id: 1, modalidade: 'Psicologia', status, data_cancelamento: null }],
      atendimento_sessao: [{ id: 70, atendimento_clinico_id: 60, status, data_cancelamento: null, data_sessao: data('2026-12-21'), hora_inicio: hora('09:30'), duracao_minutos: 30 }],
    };
    const banco = simularBanco(t, inicial), antes = structuredClone(banco);
    await assert.rejects(() => confirmarTermino(2026, { data_fim: '2026-12-23' }), (erro) => {
      assert.equal(erro.statusCode, 409);
      assert.equal(erro.conflitos[0].oficina_nome, 'Turma 10');
      assert.equal(erro.conflitos[0].sessao_id, 70);
      return true;
    });
    assert.deepEqual(banco, antes);
  });
}

test('criação de calendário verifica conflitos novos e não duplica conflito já coberto por outro calendário', async (t) => {
  const inicial = planejamentoParaStatus();
  inicial.ano_letivo = [calendarioTeste(2026, '2026-02-03', '2026-12-19')];
  inicial.atendimento_sessao = [{ id: 70, atendimento_clinico_id: 60, status: 'ATIVO', data_cancelamento: null, data_sessao: data('2027-01-04'), hora_inicio: hora('10:30'), duracao_minutos: 30 }];
  inicial.turma.find((t) => t.tipo === 'OFICINA').horarios[0].hora_fim = hora('11:00');
  const banco = simularBanco(t, inicial);
  await assert.rejects(() => criarAnoLetivoService({ ano: 2027, data_inicio: '2027-01-04', data_fim: '2027-12-18' }), (erro) => erro.conflitos?.length === 1);
  assert.equal(banco.ano_letivo.length, 1);
  banco.ano_letivo.push(calendarioTeste(2028, '2027-01-04', '2027-12-18'));
  await criarAnoLetivoService({ ano: 2027, data_inicio: '2027-01-04', data_fim: '2027-12-18' });
  assert.equal(banco.ano_letivo.length, 3);
});

test('ano de calendário com turma excluída continua bloqueado e calendário duplicado não grava', async (t) => {
  const banco = simularBanco(t, { ano_letivo: [calendarioTeste(2027, '2027-02-08', '2027-12-18')],
    turma: [{ ...turma(20, 'REGULAR'), ano_letivo_id: 2027, deleted_at: new Date() }] });
  await assert.rejects(() => editarAnoLetivoService(2027, { ano: 2028 }), { statusCode: 409 });
  await assert.rejects(() => criarAnoLetivoService({ ano: 2027, data_inicio: '2027-02-08', data_fim: '2027-12-18' }), { statusCode: 409 });
  assert.equal(banco.ano_letivo.length, 1);
});

test('rascunho ativa regular futuro no início do calendário e preserva unicidade entre anos', async (t) => {
  const banco = simularBanco(t, { pessoa: [pessoaEdicao], turma: [{ ...turma(20, 'REGULAR', 10), ano_letivo_id: 2027 }, turma(21, 'REGULAR', 10)],
    matricula_turma: [{ id: 1, aluno_id: 1, turma_id: 20, status: 'PROVISORIO', data_inicio: null, data_fim: null }] });
  await editarAlunoService(1, { status: 'ATIVO' });
  assert.deepEqual(banco.matricula_turma[0].data_inicio, data('2027-02-08'));
  assert.equal(banco.matricula_turma[0].status, 'ATIVO');
  await assert.rejects(() => matricularTurmaRegularService({ aluno_id: 1, turma_id: 21 }), (erro) => erro.isConflict && erro.detalhes.some((d) => d.codigo === 'MATRICULA_DUPLICADA'));
});

for (const rascunho of [false, true]) {
  test(`ano encerrado ${rascunho ? 'encerra planejamento antes de ativar rascunho' : 'bloqueia nova matrícula mesmo com turma ativa'}`, async (t) => {
    const banco = simularBanco(t, { pessoa: [pessoaEdicao], aluno: [aluno(1, rascunho ? 'RASCUNHO' : 'ATIVO')],
      ano_letivo: [calendarioTeste(2026, '2026-02-03', '2026-10-31')], turma: [turma(20, 'REGULAR', 10)],
      matricula_turma: rascunho ? [{ id: 1, aluno_id: 1, turma_id: 20, status: 'PROVISORIO', data_inicio: null, data_fim: null }] : [] });
    const antes = structuredClone(banco);
    if (rascunho) {
      await editarAlunoService(1, { status: 'ATIVO' });
      assert.equal(banco.aluno[0].status, 'ATIVO');
      assert.equal(banco.matricula_turma[0].status, 'PROVISORIO');
      assert.deepEqual(banco.matricula_turma[0].data_fim, data('2026-10-31'));
    } else {
      await assert.rejects(() => matricularTurmaRegularService({ aluno_id: 1, turma_id: 20 }), { statusCode: 409 });
      assert.deepEqual(banco, antes);
    }
  });
}

test('atendimento pode ser criado nas férias e alteração do calendário futuro é bloqueada se revelar choque', async (t) => {
  const banco = simularBanco(t, { pessoa: [{ id: 1, nome: 'Aluno' }], aluno: [aluno(1, 'ATIVO')], turma: [turma(10)],
    ano_letivo: [calendarioTeste(2027, '2027-02-08', '2027-12-18')],
    matricula_turma: [{ id: 1, aluno_id: 1, turma_id: 10, status: 'ATIVO', data_inicio: data('2026-01-01'), data_fim: null }] });
  await agendarAtendimentoService({ ...pedidoClinico, data_inicio: '2027-01-04' });
  const sessoes = structuredClone(banco.atendimento_sessao);
  await assert.rejects(() => editarAnoLetivoService(2027, { data_inicio: '2027-01-04' }), (erro) => erro.conflitos?.length === 1);
  assert.deepEqual(banco.atendimento_sessao, sessoes);
  assert.deepEqual(banco.ano_letivo[0].data_inicio, data('2027-02-08'));
});

test('ativação verifica oficinas sobrepostas mesmo quando o próximo período letivo está distante', async (t) => {
  const banco = simularBanco(t, { pessoa: [pessoaEdicao], turma: [turma(10), turma(11)],
    ano_letivo: [calendarioTeste(2027, '2027-02-08', '2027-12-18')],
    matricula_turma: [10,11].map((turma_id) => ({ id: turma_id, aluno_id: 1, turma_id, status: 'PROVISORIO', data_inicio: null, data_fim: null })) });
  const antes = structuredClone(banco);
  await assert.rejects(() => editarAlunoService(1, { status: 'ATIVO' }), (e) => e.isConflict && e.detalhes.some((d) => d.mensagem.includes('Conflito entre as oficinas')));
  assert.deepEqual(banco, antes);
});
const aluno = (id, status = 'RASCUNHO') => ({ id, pessoa_id: id, status, turno: 'MANHA', dias_frequencia: [1, 2, 3, 4, 5] });
const turma = (id, tipo = 'OFICINA', capacidade_maxima = 1) => ({
  ano_letivo_id: tipo === 'REGULAR' ? 2026 : null,
  id, tipo, capacidade_maxima, status: 'ATIVO', nome: `Turma ${id}`, turno: 'MANHA', profissional_id: 1,
  horarios: (tipo === 'REGULAR' ? [1, 2, 3, 4, 5] : [1]).map((dia_semana) => ({
    id: dia_semana, dia_semana, hora_inicio: hora(tipo === 'REGULAR' ? '08:00' : '09:00'),
    hora_fim: hora(tipo === 'REGULAR' ? '12:00' : '10:00')
  }))
});
const pedidoClinico = { aluno_id: 1, profissional_id: 1, modalidade: 'Psicologia', tipo_recorrencia: 'EVENTUAL',
  data_inicio: '2026-11-02', hora_inicio: '09:30', duracao_minutos: 30 };

const pessoaEdicao = { id: 1, nome: 'Aluno Teste', telefone: null, status_geral: 'INATIVO' };

function planejamentoParaStatus(statusAluno = 'ATIVO') {
  const status = statusAluno === 'RASCUNHO' ? 'PROVISORIO' : 'ATIVO';
  const regular = turma(10, 'REGULAR');
  const oficina = turma(20);
  oficina.horarios[0].hora_inicio = hora('10:00');
  return {
    aluno: [aluno(1, statusAluno)], pessoa: [{ ...pessoaEdicao, status_geral: statusAluno === 'ATIVO' ? 'ATIVO' : 'INATIVO' }],
    turma: [regular, oficina],
    matricula_turma: [10, 20].map((turma_id, i) => ({ id: i + 1, aluno_id: 1, turma_id,
      status, data_inicio: status === 'ATIVO' ? data('2026-10-01') : null, data_fim: null })),
    atendimento_clinico: [{ id: 60, aluno_id: 1, profissional_id: 1, modalidade: 'Psicologia', tipo_recorrencia: 'SEMANAL',
      status, data_inicio: data('2026-10-01'), data_termino: null, data_cancelamento: null }],
    atendimento_sessao: [
      { id: 70, data_sessao: data('2026-11-01'), hora_inicio: hora('08:00') },
      { id: 71, data_sessao: data('2026-11-02'), hora_inicio: hora('08:30') },
      { id: 72, data_sessao: data('2026-11-02'), hora_inicio: hora('09:00') },
      { id: 73, data_sessao: data('2026-11-02'), hora_inicio: hora('09:01') },
      { id: 74, data_sessao: data('2026-11-03'), hora_inicio: hora('08:00') },
    ].map((s) => ({ ...s, atendimento_clinico_id: 60, profissional_id: 1, status, duracao_minutos: 60, data_cancelamento: null })),
    ocorrencia_aluno: [],
  };
}

function planejamentoParaExclusao(status = 'ATIVO') {
  const inicial = planejamentoParaStatus(status);
  Object.assign(inicial.aluno[0], { participa_almoco: true, participa_procan: true, observacoes: 'Observações pessoais.' });
  Object.assign(inicial.pessoa[0], { telefone: '51999999999', data_nascimento: data('2010-01-01') });
  inicial.aluno_dados_medicos = [{ aluno_id: 1, restricao_alimentar: 'Restrição' }];
  inicial.ocorrencia_aluno = [{ id: 80, aluno_id: 1, resumo: 'Registro histórico', descricao: 'Descrição preservada', usuario_relator_id: 7 }];
  return inicial;
}

for (const status of ['ATIVO', 'INATIVO', 'RASCUNHO']) {
  test(`exclusão de ${status} minimiza cadastro e preserva histórico, encerrando somente sessões futuras`, async (t) => {
    const banco = simularBanco(t, planejamentoParaExclusao(status));
    const historico = structuredClone(banco.ocorrencia_aluno);
    const sessoesPassadas = structuredClone(banco.atendimento_sessao.slice(0, 3));
    await excluirAlunoService(1);
    const alunoExcluido = banco.aluno[0];
    assert.equal(alunoExcluido.status, status === 'ATIVO' ? 'INATIVO' : status);
    assert.equal(alunoExcluido.deleted_at.toISOString(), '2026-11-02T12:00:00.000Z');
    for (const campo of ['turno', 'participa_almoco', 'participa_procan', 'observacoes']) assert.equal(alunoExcluido[campo], null);
    assert.deepEqual(alunoExcluido.dias_frequencia, []);
    assert.equal(banco.pessoa[0].nome, pessoaEdicao.nome);
    assert.equal(banco.pessoa[0].telefone, null);
    assert.equal(banco.pessoa[0].data_nascimento, null);
    assert.equal(banco.pessoa[0].status_geral, 'INATIVO');
    assert.equal(banco.aluno_dados_medicos.length, 0);
    assert.deepEqual(banco.ocorrencia_aluno, historico);
    assert.equal(banco.matricula_turma.length, 2);
    assert.ok(banco.matricula_turma.every((m) => m.data_fim && m.status === (status === 'RASCUNHO' ? 'PROVISORIO' : 'INATIVO')));
    assert.ok(banco.atendimento_clinico[0].data_cancelamento);
    assert.equal(banco.atendimento_clinico[0].status, status === 'RASCUNHO' ? 'PROVISORIO' : 'INATIVO');
    assert.deepEqual(banco.atendimento_sessao.slice(0, 3), sessoesPassadas);
    assert.ok(banco.atendimento_sessao.slice(3).every((s) => s.data_cancelamento && s.status === (status === 'RASCUNHO' ? 'PROVISORIO' : 'INATIVO')));
    assert.equal(await obterAlunoService(1), null);
    assert.deepEqual(await listarAlunosService(), []);
  });
}

test('exclusão remove responsável exclusivo e preserva pessoas compartilhadas ou de outros perfis', async (t) => {
  const inicial = planejamentoParaExclusao();
  inicial.aluno.push(aluno(2, 'ATIVO'), aluno(3, 'ATIVO'));
  inicial.pessoa.push(...[81, 82, 83, 84].map((id) => ({ id, nome: `Pessoa ${id}`, telefone: '51999999999' })));
  inicial.funcionario = [{ id: 1, pessoa_id: 83, cargo: 'Professor' }];
  inicial.usuario = [{ id: 7, pessoa_id: 84, role: 'professor' }];
  inicial.aluno_responsavel = [81, 82, 83, 84, 3].map((pessoa_id) => ({ id: pessoa_id, aluno_id: 1, pessoa_id }));
  inicial.aluno_responsavel.push({ id: 90, aluno_id: 2, pessoa_id: 82 });
  const banco = simularBanco(t, inicial);
  await excluirAlunoService(1);
  assert.deepEqual(banco.aluno_responsavel, [{ id: 90, aluno_id: 2, pessoa_id: 82 }]);
  assert.equal(banco.pessoa.some((p) => p.id === 81), false);
  for (const id of [82, 83, 84]) assert.equal(banco.pessoa.find((p) => p.id === id).telefone, '51999999999');
  assert.equal(banco.aluno.some((a) => a.id === 3), true);
});

test('aluno excluído não pode ser lido, editado, reativado ou receber operações nos seus vínculos', async (t) => {
  const banco = simularBanco(t, planejamentoParaExclusao('RASCUNHO'));
  await excluirAlunoService(1);
  const antes = JSON.stringify(banco);
  const acoes = [
    () => obterOficinasService(1), () => obterAtendimentosService(1),
    () => obterAgendaAlunoService(1, '2026-11-02'),
    () => editarAlunoService(1, { nome: 'Tentativa' }), () => alterarStatusAlunoService(1, { status: 'ATIVO' }),
    () => matricularTurmaRegularService({ aluno_id: 1, turma_id: 10 }),
    () => matricularOficinasService({ aluno_id: 1, oficinas_ids: [20] }),
    () => cancelarOficinaService({ aluno_id: 1, matricula_id: 2 }),
    () => removerMatriculaProvisoriaService({ aluno_id: 1, matricula_id: 1 }),
    () => agendarAtendimentoService(pedidoClinico),
    () => obterAtendimentoService({ aluno_id: 1, atendimento_id: 60 }),
    () => editarAtendimentoService({ aluno_id: 1, atendimento_id: 60 }, { modalidade: 'Tentativa' }),
    () => cancelarAtendimentoService({ aluno_id: 1, atendimento_id: 60 }),
    () => removerAtendimentoProvisorioService({ aluno_id: 1, atendimento_id: 60 }),
    () => listarOcorrenciasService(1),
    () => criarOcorrenciaService(1, 7, { resumo: 'Teste', descricao: 'Teste', data: '2026-11-02', hora: '08:00' }),
    () => editarOcorrenciaService(1, 80, { resumo: 'Tentativa' }), () => excluirOcorrenciaService(1, 80),
    () => excluirAlunoService(1), () => excluirAlunoService(999),
  ];
  for (const acao of acoes) await assert.rejects(acao, (erro) => erro.statusCode === 404 || erro.status === 404);
  assert.equal(JSON.stringify(banco), antes);
});

test('falha na limpeza desfaz exclusão, cancelamentos e remoção dos dados médicos', async (t) => {
  const banco = simularBanco(t, planejamentoParaExclusao());
  const antes = JSON.stringify(banco), transacao = prisma.$transaction;
  prisma.$transaction = (callback, options) => transacao(async (tx) => {
    tx.pessoa.update = async () => { throw new Error('Falha ao minimizar pessoa'); };
    return callback(tx);
  }, options);
  await assert.rejects(() => excluirAlunoService(1), /Falha ao minimizar pessoa/);
  assert.equal(JSON.stringify(banco), antes);
});

test('exclusão serializa edição e criação de ocorrência concorrentes, sem recriar dados pessoais', async (t) => {
  const banco = simularBanco(t, planejamentoParaExclusao());
  const resultados = await Promise.allSettled([
    excluirAlunoService(1), editarAlunoService(1, { telefone: '51911112222' }),
    criarOcorrenciaService(1, 7, { resumo: 'Teste', descricao: 'Teste', data: '2026-11-02', hora: '08:00' }),
  ]);
  assert.equal(resultados[0].status, 'fulfilled');
  assert.equal(resultados[1].status, 'rejected'); assert.equal(resultados[2].status, 'rejected');
  assert.equal(banco.pessoa[0].telefone, null);
  assert.equal(banco.ocorrencia_aluno.length, 1);
});

test('exclusões concorrentes de irmãos só removem a pessoa responsável após o último vínculo', async (t) => {
  const inicial = planejamentoParaExclusao();
  inicial.aluno.push(aluno(2, 'ATIVO')); inicial.pessoa.push({ id: 2, nome: 'Outro aluno' }, { id: 81, nome: 'Responsável' });
  inicial.aluno_responsavel = [{ id: 1, aluno_id: 1, pessoa_id: 81 }, { id: 2, aluno_id: 2, pessoa_id: 81 }];
  const banco = simularBanco(t, inicial);
  await Promise.all([excluirAlunoService(1), excluirAlunoService(2)]);
  assert.equal(banco.aluno_responsavel.length, 0);
  assert.equal(banco.pessoa.some((p) => p.id === 81), false);
  assert.ok(banco.aluno.every((a) => a.deleted_at));
});

test('DELETE exige administração e todos os GETs do aluno excluído retornam 404', async (t) => {
  const express = require('express');
  const { createServer } = require('node:http');
  const { alunoLeituraRoutes, alunoAdminRoutes } = require('../routes/alunoRoutes');
  simularBanco(t, planejamentoParaExclusao());
  const app = express(); app.use(express.json());
  app.use('/api', (req, res, next) => { if (req.get('x-test-role')) req.usuario = { role: req.get('x-test-role') }; next(); }, alunoLeituraRoutes, alunoAdminRoutes, require('../routes/ocorrenciaRoutes'), require('../routes/atendimentosRoutes'));
  const server = createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  for (const [method, caminho, role, esperado] of [
    ['DELETE', '/alunos/1', null, 401], ['DELETE', '/alunos/1', 'professor', 403], ['DELETE', '/alunos/abc', 'admin', 400],
    ['DELETE', '/alunos/1', 'admin', 204], ['DELETE', '/alunos/1', 'admin', 404],
    ...['', '/oficinas', '/atendimentos', '/agenda', '/ocorrencias', '/atendimentos/60'].map((sufixo) => ['GET', `/alunos/1${sufixo}`, 'admin', 404]),
  ]) {
    const resposta = await fetch(`http://127.0.0.1:${server.address().port}/api${caminho}`, { method, headers: role ? { 'x-test-role': role } : {} });
    assert.equal(resposta.status, esperado, `${method} ${caminho}`);
  }
});

test('inativação encerra matrículas e atendimentos e preserva sessões passadas ou iniciadas', async (t) => {
  const banco = simularBanco(t, planejamentoParaStatus());
  banco.matricula_turma.push({ id: 3, aluno_id: 1, turma_id: 10, status: 'INATIVO', data_inicio: data('2026-01-01'), data_fim: data('2026-02-01') });
  banco.atendimento_clinico.push({ ...banco.atendimento_clinico[0], id: 61, status: 'INATIVO', data_cancelamento: data('2026-02-01') });
  await alterarStatusAlunoService(1, { status: 'INATIVO' });
  assert.equal(banco.aluno[0].status, 'INATIVO');
  assert.equal(banco.pessoa[0].status_geral, 'INATIVO');
  assert.deepEqual(banco.matricula_turma.map((m) => [m.status, m.data_fim]), [
    ['INATIVO', data('2026-11-02')], ['INATIVO', data('2026-11-01')], ['INATIVO', data('2026-02-01')],
  ]);
  assert.equal(banco.atendimento_clinico[0].status, 'INATIVO');
  assert.deepEqual(banco.atendimento_clinico[0].data_cancelamento, data('2026-11-02'));
  assert.deepEqual(banco.atendimento_clinico[1].data_cancelamento, data('2026-02-01'));
  for (const sessao of banco.atendimento_sessao) {
    assert.equal(sessao.status, sessao.id < 73 ? 'ATIVO' : 'INATIVO');
    assert.deepEqual(sessao.data_cancelamento, sessao.id < 73 ? null : data('2026-11-02'));
  }
});

test('reativação sincroniza a pessoa sem promover ou restaurar qualquer vínculo', async (t) => {
  const banco = simularBanco(t, planejamentoParaStatus());
  await alterarStatusAlunoService(1, { status: 'INATIVO' });
  const historico = JSON.stringify([banco.matricula_turma, banco.atendimento_clinico, banco.atendimento_sessao]);
  await alterarStatusAlunoService(1, { status: 'ATIVO' });
  assert.equal(banco.aluno[0].status, 'ATIVO');
  assert.equal(banco.pessoa[0].status_geral, 'ATIVO');
  assert.equal(JSON.stringify([banco.matricula_turma, banco.atendimento_clinico, banco.atendimento_sessao]), historico);
  assert.equal(banco.matricula_turma.some((m) => m.status === 'ATIVO'), false);
  assert.equal(banco.atendimento_clinico.some((a) => a.status === 'ATIVO'), false);
  assert.equal(banco.atendimento_sessao.some((s) => s.id >= 73 && s.status === 'ATIVO'), false);
});

test('inativar rascunho encerra planejamento preservando PROVISORIO; reativação não o efetiva', async (t) => {
  const banco = simularBanco(t, planejamentoParaStatus('RASCUNHO'));
  await alterarStatusAlunoService(1, { status: 'INATIVO' });
  assert.ok(banco.matricula_turma.every((m) => m.status === 'PROVISORIO' && m.data_fim));
  assert.equal(banco.atendimento_clinico[0].status, 'PROVISORIO');
  assert.deepEqual(banco.atendimento_clinico[0].data_cancelamento, data('2026-11-02'));
  assert.ok(banco.atendimento_sessao.every((s) => s.status === 'PROVISORIO'));
  assert.ok(banco.atendimento_sessao.filter((s) => s.id >= 73).every((s) => s.data_cancelamento));
  await alterarStatusAlunoService(1, { status: 'ATIVO' });
  assert.ok(banco.matricula_turma.every((m) => m.status === 'PROVISORIO' && m.data_fim));
  assert.equal((await obterAgendaAlunoService(1, '2026-11-02')).eventos.length, 0);
});

test('aluno ativo com vínculo provisório residual o encerra como INATIVO', async (t) => {
  const inicial = planejamentoParaStatus();
  inicial.matricula_turma[0].status = 'PROVISORIO';
  inicial.atendimento_clinico[0].status = 'PROVISORIO';
  inicial.atendimento_sessao[4].status = 'PROVISORIO';
  const banco = simularBanco(t, inicial);
  await alterarStatusAlunoService(1, { status: 'INATIVO' });
  assert.equal(banco.matricula_turma[0].status, 'INATIVO');
  assert.equal(banco.atendimento_clinico[0].status, 'INATIVO');
  assert.equal(banco.atendimento_sessao[4].status, 'INATIVO');
});

test('edição de aluno inativo mantém status, permite dados pessoais e rejeita turma regular', async (t) => {
  const banco = simularBanco(t, planejamentoParaStatus('INATIVO'));
  banco.matricula_turma = []; banco.atendimento_clinico = []; banco.atendimento_sessao = [];
  await editarAlunoService(1, { nome: 'Nome atualizado', telefone: '51999999999', observacoes: 'Atualização cadastral.' });
  assert.equal(banco.aluno[0].status, 'INATIVO');
  assert.equal(banco.pessoa[0].status_geral, 'INATIVO');
  assert.equal(banco.pessoa[0].nome, 'Nome atualizado');
  await assert.rejects(() => editarAlunoService(1, { turma_id: 10 }), { statusCode: 409 });
  assert.equal(banco.matricula_turma.length, 0);
});

test('aluno inativo não recebe matrícula regular, oficina, atendimento ou ocorrência', async (t) => {
  const banco = simularBanco(t, planejamentoParaStatus('INATIVO'));
  banco.matricula_turma = []; banco.atendimento_clinico = []; banco.atendimento_sessao = [];
  await assert.rejects(() => matricularTurmaRegularService({ aluno_id: 1, turma_id: 10 }), { statusCode: 404 });
  await assert.rejects(() => matricularOficinasService({ aluno_id: 1, oficinas_ids: [20] }), { statusCode: 404 });
  await assert.rejects(() => agendarAtendimentoService(pedidoClinico), { statusCode: 404 });
  await assert.rejects(() => criarOcorrenciaService(1, 1, { resumo: 'Resumo', descricao: 'Descrição', data: '2026-11-02', hora: '08:00' }), { statusCode: 409 });
  assert.equal(banco.matricula_turma.length + banco.atendimento_clinico.length + banco.ocorrencia_aluno.length, 0);
});

test('inativação concorrente impede criação de ocorrência e inscrição após o encerramento', async (t) => {
  const banco = simularBanco(t, planejamentoParaStatus());
  const resultados = await Promise.allSettled([
    alterarStatusAlunoService(1, { status: 'INATIVO' }),
    criarOcorrenciaService(1, 1, { resumo: 'Resumo', descricao: 'Descrição', data: '2026-11-02', hora: '08:00' }),
    matricularOficinasService({ aluno_id: 1, oficinas_ids: [20] }),
  ]);
  assert.equal(resultados[0].status, 'fulfilled');
  assert.equal(resultados[1].status, 'rejected');
  assert.equal(resultados[2].status, 'rejected');
  assert.equal(banco.ocorrencia_aluno.length, 0);
});

test('falha na pessoa reverte inativação do aluno e encerramento dos vínculos', async (t) => {
  const banco = simularBanco(t, planejamentoParaStatus());
  const antes = JSON.stringify(banco);
  const transacao = prisma.$transaction;
  prisma.$transaction = (callback) => transacao(async (tx) => {
    tx.pessoa.update = async () => { throw new Error('Falha simulada'); };
    return callback(tx);
  });
  await assert.rejects(() => alterarStatusAlunoService(1, { status: 'INATIVO' }), /Falha simulada/);
  assert.equal(JSON.stringify(banco), antes);
});

test('endpoint de status rejeita rascunho, campos extras e ativação que contornaria o planejamento', async (t) => {
  simularBanco(t, planejamentoParaStatus('RASCUNHO'));
  for (const dados of [{}, { status: 'RASCUNHO' }, { status: 'ATIVO', nome: 'Nome' }]) {
    await assert.rejects(() => alterarStatusAlunoService(1, dados), { name: 'ZodError' });
  }
  await assert.rejects(() => alterarStatusAlunoService(1, { status: 'ATIVO' }), { statusCode: 409 });
  await assert.rejects(() => alterarStatusAlunoService(999, { status: 'INATIVO' }), { statusCode: 404 });
});

test('repetir a inativação preserva datas de encerramento e não cancela sessões históricas', async (t) => {
  const banco = simularBanco(t, planejamentoParaStatus());
  await alterarStatusAlunoService(1, { status: 'INATIVO' });
  const encerrado = JSON.stringify(banco);
  await alterarStatusAlunoService(1, { status: 'INATIVO' });
  assert.equal(JSON.stringify(banco), encerrado);
});

test('rota PATCH de status exige administração e valida entrada antes de alterar o aluno', async (t) => {
  const express = require('express');
  const { createServer } = require('node:http');
  const { alunoAdminRoutes } = require('../routes/alunoRoutes');
  const banco = simularBanco(t, planejamentoParaStatus());
  const app = express(); app.use(express.json());
  app.use('/api', (req, res, next) => { if (req.get('x-test-role')) req.usuario = { role: req.get('x-test-role') }; next(); }, alunoAdminRoutes);
  const server = createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  for (const [id, role, body, esperado] of [
    [1, null, { status: 'INATIVO' }, 401], [1, 'professor', { status: 'INATIVO' }, 403],
    [1, 'admin', {}, 400], [1, 'admin', { status: 'RASCUNHO' }, 400], [1, 'admin', { status: 'INATIVO', nome: 'Nome' }, 400],
    [999, 'admin', { status: 'INATIVO' }, 404], [1, 'admin', { status: 'INATIVO' }, 200], [1, 'admin', { status: 'ATIVO' }, 200],
  ]) {
    const resposta = await fetch(`http://127.0.0.1:${server.address().port}/api/alunos/${id}/status`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, body: JSON.stringify(body),
    });
    assert.equal(resposta.status, esperado);
  }
  assert.equal(banco.aluno[0].status, 'ATIVO');
  assert.ok(banco.matricula_turma.every((m) => m.status === 'INATIVO'));
});

function corresponde(registro, filtro = {}) {
  return Object.entries(filtro).every(([campo, esperado]) => {
    if (campo === 'OR') return esperado.some((item) => corresponde(registro, item));
    if (campo === 'AND') return esperado.every((item) => corresponde(registro, item));
    if (campo === 'is') return esperado === null ? registro == null : corresponde(registro, esperado);
    const atual = registro[campo];
    if (esperado === null || typeof esperado !== 'object') return atual === esperado;
    if ('is' in esperado) return esperado.is === null ? atual == null : atual != null && corresponde(atual, esperado.is);
    if ('none' in esperado) return atual.every((item) => !corresponde(item, esperado.none));
    if ('some' in esperado) return atual.some((item) => corresponde(item, esperado.some));
    if ('not' in esperado) return atual != null && atual !== esperado.not;
    if ('notIn' in esperado) return !esperado.notIn.includes(atual);
    if ('in' in esperado) return esperado.in.includes(atual);
    if ('lt' in esperado) return atual != null && atual < esperado.lt;
    if ('lte' in esperado) return atual != null && atual <= esperado.lte;
    if ('gte' in esperado) return atual != null && atual >= esperado.gte;
    if ('gt' in esperado) return atual != null && atual > esperado.gt;
    return atual != null && corresponde(atual, esperado);
  });
}

function planejamentoProfissional() {
  const clinico = (id, profissional_id, status) => ({ id, aluno_id: 1, profissional_id, status, data_cancelamento: null,
    modalidade: `Clínica ${id}`, tipo_recorrencia: 'SEMANAL', data_inicio: data('2026-10-01'), hora_inicio: hora('10:00'),
    duracao_minutos: 60, frequencia: 1, dias_semana: [1], data_termino: data('2026-12-01') });
  const sessao = (id, atendimento_clinico_id, dia, horario, status = 'PROVISORIO', profissional_id = 1) => ({
    id, atendimento_clinico_id, data_sessao: data(dia), hora_inicio: hora(horario), duracao_minutos: 60, status, profissional_id, data_cancelamento: null,
  });
  return { pessoa: [pessoaEdicao, { id: 10, nome: 'Ana', status_geral: 'ATIVO', telefone: '51999999999', data_nascimento: data('1980-01-01') },
      { id: 11, nome: 'Bruno', status_geral: 'ATIVO', telefone: '51911112222' }],
    funcionario: [{ id: 1, pessoa_id: 10, cargo: 'Professor' }, { id: 2, pessoa_id: 11, cargo: 'Professor' }],
    usuario: [{ id: 7, pessoa_id: 10, email: 'ana@example.invalid', senha_hash: 'hash-exemplo', role: 'professor', status: 'ATIVO' },
      { id: 8, pessoa_id: 11, email: 'bruno@example.invalid', senha_hash: 'outro-hash', role: 'professor', status: 'ATIVO' }],
    turma: [{ ...turma(10, 'REGULAR'), status: 'INATIVO' }], ambiente: [{ id: 2, nome: 'Sala' }],
    atendimento_clinico: [clinico(60, 1, 'PROVISORIO'), clinico(61, 1, 'ATIVO'), clinico(62, 2, 'PROVISORIO')],
    atendimento_sessao: [sessao(70, 60, '2026-11-01', '08:00'), sessao(71, 60, '2026-11-02', '08:30'),
      sessao(72, 60, '2026-11-02', '09:00'), sessao(73, 60, '2026-11-02', '10:00'),
      sessao(74, 62, '2026-11-03', '10:00'), sessao(75, 62, '2026-11-04', '10:00', 'PROVISORIO', 2),
      sessao(76, 61, '2026-11-01', '08:00', 'ATIVO')],
    ocorrencia_aluno: [{ id: 80, aluno_id: 1, usuario_relator_id: 7, resumo: 'Histórico', descricao: 'Preservar' }],
  };
}

function cadastroUsuarioParaExclusao() {
  return {
    pessoa: [{ id: 50, nome: 'Pessoa Teste', status_geral: 'ATIVO', telefone: '51999999999', data_nascimento: data('1980-01-01') }],
    usuario: [{ id: 7, pessoa_id: 50, email: 'teste@example.invalid', senha_hash: 'hash-teste', role: 'admin', status: 'ATIVO' }],
    funcionario: [], aluno: [],
  };
}

for (const status of ['ATIVO', 'INATIVO']) {
  test(`excluir usuário ${status} remove credenciais, inativa pessoa sem outro vínculo e impede acesso e restauração`, async (t) => {
    const inicial = cadastroUsuarioParaExclusao();
    inicial.usuario[0].status = status;
    const banco = simularBanco(t, inicial);
    await excluirUsuario(7);
    assert.equal(banco.usuario[0].deleted_at.toISOString(), '2026-11-02T12:00:00.000Z');
    assert.equal(banco.usuario[0].status, 'INATIVO');
    assert.equal(banco.usuario[0].email, null);
    assert.equal(banco.usuario[0].senha_hash, null);
    assert.equal(banco.usuario[0].pessoa_id, 50);
    assert.equal(banco.usuario[0].role, 'admin');
    assert.deepEqual(banco.pessoa[0], { ...inicial.pessoa[0], status_geral: 'INATIVO' });
    assert.deepEqual(await listarUsuarios(), []);
    assert.equal(await buscarIdentidadePorId(7), null);
    await assert.rejects(() => excluirUsuario(7), { statusCode: 404 });
    await assert.rejects(() => editarUsuario(7, { status: 'ATIVO' }), { statusCode: 404 });
    await assert.rejects(() => editarUsuario(7, { senha: 'nova-senha' }), { statusCode: 404 });
  });
}

for (const vinculo of ['funcionario', 'aluno ativo', 'aluno inativo', 'aluno rascunho', 'responsavel', 'perfis excluidos']) {
  test(`exclusão de usuário considera outros vínculos: ${vinculo}`, async (t) => {
    const inicial = cadastroUsuarioParaExclusao();
    if (vinculo === 'funcionario') inicial.funcionario = [{ id: 1, pessoa_id: 50, cargo: 'Professor' }];
    if (vinculo.startsWith('aluno')) inicial.aluno = [{ ...aluno(1, vinculo.split(' ')[1].toUpperCase()), pessoa_id: 50 }];
    if (vinculo === 'responsavel') inicial.aluno_responsavel = [{ id: 1, pessoa_id: 50, aluno_id: 2 }];
    if (vinculo === 'perfis excluidos') {
      inicial.funcionario = [{ id: 1, pessoa_id: 50, deleted_at: data('2026-11-01') }];
      inicial.aluno = [{ ...aluno(1), pessoa_id: 50, deleted_at: data('2026-11-01') }];
    }
    const banco = simularBanco(t, inicial);
    await excluirUsuario(7);
    assert.equal(banco.pessoa[0].status_geral, vinculo === 'perfis excluidos' ? 'INATIVO' : 'ATIVO');
    assert.deepEqual(banco.funcionario, inicial.funcionario);
    assert.deepEqual(banco.aluno, inicial.aluno);
  });
}

test('exclusão de usuário preserva profissional, agenda e autoria de ocorrências, sem cancelar provisórios', async (t) => {
  const inicial = planejamentoProfissional();
  const banco = simularBanco(t, inicial);
  await excluirUsuario(7);
  for (const tabela of ['pessoa', 'funcionario', 'turma', 'atendimento_clinico', 'atendimento_sessao', 'ocorrencia_aluno']) {
    assert.deepEqual(banco[tabela], inicial[tabela]);
  }
  assert.equal(banco.usuario[1].status, 'ATIVO');
  await editarProfissionalService(1, { status_geral: 'ATIVO' });
  assert.equal(banco.usuario[0].status, 'INATIVO');
  assert.equal(banco.usuario[0].email, null);
});

test('excluir usuário de pessoa com outro vínculo preserva também seu status inativo', async (t) => {
  const inicial = cadastroUsuarioParaExclusao();
  inicial.pessoa[0].status_geral = 'INATIVO';
  inicial.funcionario = [{ id: 1, pessoa_id: 50, cargo: 'Professor' }];
  const banco = simularBanco(t, inicial);
  await excluirUsuario(7);
  assert.equal(banco.pessoa[0].status_geral, 'INATIVO');
});

test('falha ao inativar pessoa reverte exclusão e remoção das credenciais do usuário', async (t) => {
  const banco = simularBanco(t, cadastroUsuarioParaExclusao());
  const antes = structuredClone(banco);
  const transacao = prisma.$transaction;
  prisma.$transaction = (operacao, opcoes) => transacao((tx) => {
    tx.pessoa.updateMany = async () => { throw new Error('Falha na pessoa'); };
    return operacao(tx);
  }, opcoes);
  await assert.rejects(() => excluirUsuario(7), /Falha na pessoa/);
  assert.deepEqual(banco, antes);
});

test('edição e exclusão concorrentes não restauram conta nem credenciais', async (t) => {
  const banco = simularBanco(t, cadastroUsuarioParaExclusao());
  const resultados = await Promise.allSettled([excluirUsuario(7), editarUsuario(7, { status: 'ATIVO', email: 'outro@example.invalid' })]);
  assert.equal(resultados[0].status, 'fulfilled');
  assert.equal(resultados[1].reason.statusCode, 404);
  assert.equal(banco.usuario[0].status, 'INATIVO');
  assert.equal(banco.usuario[0].email, null);
});

test('excluir usuário inexistente retorna 404 sem modificar outras contas', async (t) => {
  const banco = simularBanco(t, cadastroUsuarioParaExclusao());
  const antes = structuredClone(banco);
  await assert.rejects(() => excluirUsuario(999), { statusCode: 404 });
  assert.deepEqual(banco, antes);
});

test('DELETE de usuário exige administração, valida ID e retorna 204 sem expor credenciais', async (t) => {
  const banco = simularBanco(t, cadastroUsuarioParaExclusao());
  const express = require('express'), { createServer } = require('node:http');
  const app = express();
  app.use((req, res, next) => { if (req.headers['x-role']) req.usuario = { id: 7, role: req.headers['x-role'] }; next(); });
  app.use('/api', require('../routes/usuarioRoutes'));
  const server = createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const excluir = (id, role = 'admin') => fetch(`http://127.0.0.1:${server.address().port}/api/usuarios/${id}`, {
    method: 'DELETE', headers: role ? { 'x-role': role } : {},
  });
  assert.equal((await excluir(7, '')).status, 401);
  assert.equal((await excluir(7, 'professor')).status, 403);
  for (const id of ['abc', '0', '-1', '1.5', '2147483648']) assert.equal((await excluir(id)).status, 400);
  assert.equal(banco.usuario[0].status, 'ATIVO');
  assert.equal((await excluir(999)).status, 404);
  const resposta = await excluir(7);
  assert.equal(resposta.status, 204);
  assert.equal(await resposta.text(), '');
  assert.equal((await excluir(7)).status, 404);
});

for (const acao of ['inativar', 'excluir']) {
  test(`${acao} profissional com apenas histórico encerra provisórios e preserva sessões iniciadas e matrículas`, async (t) => {
    const inicial = planejamentoProfissional();
    inicial.matricula_turma = [{ id: 1, aluno_id: 1, turma_id: 10, status: 'PROVISORIO', data_inicio: null, data_fim: null }];
    const banco = simularBanco(t, inicial);
    const historico = structuredClone(banco.atendimento_sessao.filter((s) => [70, 71, 72, 76].includes(s.id)));
    const matriculas = structuredClone(banco.matricula_turma);
    if (acao === 'excluir') await excluirProfissionalService(1);
    else await editarProfissionalService(1, { status_geral: 'INATIVO' });
    assert.equal(banco.pessoa.find((p) => p.id === 10).status_geral, 'INATIVO');
    assert.equal(banco.usuario[0].status, 'INATIVO');
    assert.equal(banco.usuario[1].status, 'ATIVO');
    assert.deepEqual(banco.atendimento_sessao.filter((s) => [70, 71, 72, 76].includes(s.id)), historico);
    assert.deepEqual(banco.matricula_turma, matriculas);
    for (const id of [60, 62]) {
      const a = banco.atendimento_clinico.find((v) => v.id === id);
      assert.equal(a.status, 'PROVISORIO'); assert.deepEqual(a.data_cancelamento, data('2026-11-02'));
    }
    for (const id of [73, 74, 75]) {
      const s = banco.atendimento_sessao.find((v) => v.id === id);
      assert.equal(s.status, 'PROVISORIO'); assert.deepEqual(s.data_cancelamento, data('2026-11-02'));
    }
    assert.equal(banco.atendimento_clinico.find((a) => a.id === 61).data_cancelamento, null);
    assert.equal(banco.ocorrencia_aluno[0].usuario_relator_id, 7);
    if (acao === 'excluir') {
      assert.equal(banco.funcionario[0].deleted_at.toISOString(), '2026-11-02T12:00:00.000Z');
      assert.deepEqual(banco.usuario[0].deleted_at, banco.funcionario[0].deleted_at);
      assert.equal(banco.usuario[0].email, null); assert.equal(banco.usuario[0].senha_hash, null);
      assert.equal(banco.pessoa.find((p) => p.id === 10).telefone, null);
      assert.equal(banco.pessoa.find((p) => p.id === 10).data_nascimento, null);
      assert.equal(banco.pessoa.find((p) => p.id === 10).nome, 'Ana');
      assert.deepEqual((await listarProfissionaisService()).map((p) => p.id), [2]);
      assert.deepEqual((await listarUsuarios()).map((u) => u.id), [8]);
      assert.equal(await buscarIdentidadePorId(7), null);
    } else {
      assert.equal(banco.usuario[0].email, 'ana@example.invalid');
      await editarProfissionalService(1, { status_geral: 'ATIVO' });
      assert.equal(banco.usuario[0].status, 'ATIVO');
      assert.ok(banco.atendimento_clinico.filter((a) => a.status === 'PROVISORIO').every((a) => a.data_cancelamento));
    }
  });

  for (const cenario of ['turma', 'oficina', 'sessao-futura', 'sessao-em-andamento', 'sessao-atravessa-meia-noite', 'profissional-da-sessao']) {
    test(`${acao} bloqueia ${cenario} e não altera status nem cancela provisórios`, async (t) => {
      const inicial = planejamentoProfissional();
      if (cenario === 'turma' || cenario === 'oficina') { inicial.turma[0].status = 'ATIVO'; inicial.turma[0].tipo = cenario === 'turma' ? 'REGULAR' : 'OFICINA'; }
      else {
        const s = inicial.atendimento_sessao.find((v) => v.id === 76);
        s.data_sessao = data(cenario === 'sessao-atravessa-meia-noite' ? '2026-11-01' : '2026-11-02');
        s.hora_inicio = hora(cenario === 'sessao-futura' ? '10:00' : cenario === 'sessao-atravessa-meia-noite' ? '23:00' : '08:30');
        if (cenario === 'sessao-atravessa-meia-noite') s.duracao_minutos = 601;
        if (cenario === 'profissional-da-sessao') inicial.atendimento_clinico.find((a) => a.id === 61).profissional_id = 2;
      }
      const banco = simularBanco(t, inicial), antes = JSON.stringify(banco);
      await assert.rejects(() => acao === 'excluir' ? excluirProfissionalService(1) : editarProfissionalService(1, { status_geral: 'INATIVO' }),
        (erro) => erro.isConflict && erro.detalhes.length > 0);
      assert.equal(JSON.stringify(banco), antes);
    });
  }
}

test('sessão que termina exatamente agora não impede exclusão e mantém o histórico', async (t) => {
  const inicial = planejamentoProfissional();
  const s = inicial.atendimento_sessao.find((v) => v.id === 76);
  s.data_sessao = data('2026-11-02'); s.hora_inicio = hora('08:00');
  const banco = simularBanco(t, inicial);
  await excluirProfissionalService(1);
  assert.equal(banco.atendimento_sessao.find((v) => v.id === 76).status, 'ATIVO');
});

test('excluído não pode ser editado ou reativado, receber conta, turma ou atendimento', async (t) => {
  const banco = simularBanco(t, planejamentoProfissional());
  await excluirProfissionalService(1);
  banco.pessoa.find((p) => p.id === 10).status_geral = 'ATIVO';
  for (const dados of [{ nome: 'Tentativa' }, { status_geral: 'ATIVO' }]) await assert.rejects(() => editarProfissionalService(1, dados), { statusCode: 404 });
  await assert.rejects(() => excluirProfissionalService(1), { statusCode: 404 });
  await assert.rejects(() => editarUsuario(7, { status: 'ATIVO' }), { statusCode: 404 });
  await assert.rejects(() => editarUsuario(7, { senha: 'nova-senha-teste' }), { statusCode: 404 });
  await assert.rejects(() => criarUsuario({ modo: 'existente', pessoa_id: 10, email: 'nova@example.invalid', senha: 'senha-de-teste', role: 'professor' }), { statusCode: 409 });
  await assert.rejects(() => criarTurmaService({ nome: 'Nova', tipo: 'REGULAR', turno: 'MANHA', ano_letivo_id: 2026, profissional_id: 1, ambiente_id: 2 }), { statusCode: 404 });
  await assert.rejects(() => editarTurmaService(10, { status: 'ATIVO' }), { statusCode: 404 });
  await assert.rejects(() => agendarAtendimentoService(pedidoClinico), { statusCode: 404 });
  assert.equal(await buscarIdentidadePorId(7), null);
  assert.equal(banco.usuario[0].senha_hash, null);
});

test('criar turma e atendimento exige profissional ativo, e reativação do rascunho ignora provisórios cancelados', async (t) => {
  const banco = simularBanco(t, planejamentoProfissional());
  await editarProfissionalService(1, { status_geral: 'INATIVO' });
  await assert.rejects(() => criarTurmaService({ nome: 'Nova', tipo: 'REGULAR', turno: 'MANHA', ano_letivo_id: 2026, profissional_id: 1, ambiente_id: 2 }), { statusCode: 400 });
  await assert.rejects(() => agendarAtendimentoService(pedidoClinico), { statusCode: 400 });
  banco.atendimento_clinico.find((a) => a.id === 61).status = 'INATIVO';
  await editarAlunoService(1, { status: 'ATIVO' });
  assert.equal(banco.aluno[0].status, 'ATIVO');
  assert.ok(banco.atendimento_clinico.filter((a) => a.status === 'PROVISORIO').every((a) => a.data_cancelamento));
  assert.ok(banco.atendimento_sessao.filter((s) => s.id !== 76).every((s) => s.status === 'PROVISORIO'));
});

test('falha ao minimizar a conta reverte exclusão e todos os cancelamentos', async (t) => {
  const banco = simularBanco(t, planejamentoProfissional()), antes = JSON.stringify(banco), transacao = prisma.$transaction;
  prisma.$transaction = (callback, options) => transacao(async (tx) => {
    tx.usuario.updateMany = async () => { throw new Error('Falha na conta'); };
    return callback(tx);
  }, options);
  await assert.rejects(() => excluirProfissionalService(1), /Falha na conta/);
  assert.equal(JSON.stringify(banco), antes);
});

test('exclusão concorrente impede novo atendimento e reativação da conta', async (t) => {
  const banco = simularBanco(t, planejamentoProfissional());
  const resultados = await Promise.allSettled([excluirProfissionalService(1), agendarAtendimentoService(pedidoClinico), editarUsuario(7, { status: 'ATIVO' })]);
  assert.equal(resultados[0].status, 'fulfilled');
  assert.equal(resultados[1].status, 'rejected'); assert.equal(resultados[2].status, 'rejected');
  assert.equal(banco.usuario[0].email, null);
  assert.ok(banco.atendimento_clinico.filter((a) => a.status === 'PROVISORIO').every((a) => a.data_cancelamento));
});

test('reatribuição concorrente de atendimento não recria sessões após exclusão do profissional anterior', async (t) => {
  const banco = simularBanco(t, planejamentoProfissional());
  const resultados = await Promise.allSettled([
    excluirProfissionalService(1), editarAtendimentoService({ aluno_id: 1, atendimento_id: 60 }, { profissional_id: 2, hora_inicio: '11:00' }),
  ]);
  assert.equal(resultados[0].status, 'fulfilled');
  assert.equal(resultados[1].status, 'rejected');
  assert.ok(banco.atendimento_clinico.find((a) => a.id === 60).data_cancelamento);
  assert.ok(banco.atendimento_sessao.filter((s) => s.id === 73).every((s) => s.data_cancelamento));
});

test('criação concorrente de usuário nunca mantém credenciais após exclusão do profissional', async (t) => {
  const inicial = planejamentoProfissional(); inicial.usuario = [];
  const banco = simularBanco(t, inicial);
  t.mock.method(require('argon2'), 'hash', async () => 'hash-de-teste');
  const resultados = await Promise.allSettled([
    criarUsuario({ modo: 'existente', pessoa_id: 10, email: 'nova@example.invalid', senha: 'senha-de-teste', role: 'professor' }),
    excluirProfissionalService(1),
  ]);
  assert.equal(resultados[1].status, 'fulfilled');
  assert.ok(banco.funcionario[0].deleted_at);
  assert.ok(banco.usuario.every((u) => u.deleted_at && u.email === null && u.senha_hash === null));
});

test('atendimento ativo e exclusão concorrentes nunca deixam sessão vigente com profissional excluído', async (t) => {
  const inicial = planejamentoProfissional(); inicial.aluno = [aluno(1, 'ATIVO')];
  const banco = simularBanco(t, inicial);
  const resultados = await Promise.allSettled([agendarAtendimentoService(pedidoClinico), excluirProfissionalService(1)]);
  assert.ok(resultados.some((r) => r.status === 'rejected'));
  if (banco.funcionario[0].deleted_at) assert.equal(banco.atendimento_clinico.some((a) => a.id !== 61 && a.status === 'ATIVO'), false);
  else assert.equal(resultados[1].status, 'rejected');
});

test('DELETE de profissional exige administração, retorna conflito e depois oculta o cadastro', async (t) => {
  const express = require('express'), { createServer } = require('node:http');
  const banco = simularBanco(t, planejamentoProfissional()); banco.turma[0].status = 'ATIVO';
  const app = express(); app.use(express.json());
  app.use('/api', (req, res, next) => { if (req.get('x-test-role')) req.usuario = { role: req.get('x-test-role') }; next(); }, require('../routes/profissionalRoutes'));
  const server = createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  for (const [role, id, esperado] of [[null, '1', 401], ['professor', '1', 403], ['admin', 'abc', 400], ['admin', '1', 409]]) {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/profissionais/${id}`, { method: 'DELETE', headers: role ? { 'x-test-role': role } : {} });
    assert.equal(res.status, esperado);
  }
  banco.turma[0].status = 'INATIVO';
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/profissionais/1`, { method: 'DELETE', headers: { 'x-test-role': 'admin' } });
  assert.equal(res.status, 204);
  assert.deepEqual((await listarProfissionaisService()).map((p) => p.id), [2]);
});

// Transações com gravações pendentes e bloqueios por registro para exercitar os services juntos.
function simularBanco(t, inicial = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-02T12:00:00.000Z') });
  const estado = { ano_letivo: [{ id: 2026, ano: 2026, data_inicio: data('2026-02-03'), data_fim: data('2026-12-19') }, { id: 2027, ano: 2027, data_inicio: data('2027-02-08'), data_fim: data('2027-12-18') }], aluno: [aluno(1), aluno(2, 'ATIVO'), aluno(3, 'ATIVO')], pessoa: [],
    turma: [turma(10), turma(20, 'REGULAR')], matricula_turma: [], atendimento_clinico: [], atendimento_sessao: [],
    aluno_responsavel: [], aluno_dados_medicos: [], usuario: [], funcionario: [{ id: 1, pessoa_id: 10, nome: 'Ana', cargo: 'Professor' }, { id: 2, pessoa_id: 11, nome: 'Bruno', cargo: 'Professor' }], ...inicial };
  let sequencia = 100;
  const filas = new Map();

  function cliente(pendentes, removidos, atualizados) {
    const ler = (nome) => [...estado[nome], ...pendentes[nome]].filter((item) => !removidos[nome].has(item.id))
      .map((item) => ({ ...(['aluno', 'funcionario', 'usuario', 'turma'].includes(nome) ? { deleted_at: null } : {}), ...item, ...atualizados[nome].get(item.id) }));
    function hidratar(nome, item) {
      if (nome === 'usuario') return { ...item, pessoa: hidratar('pessoa', ler('pessoa').find((p) => p.id === item.pessoa_id)) };
      if (nome === 'funcionario') return { ...item, pessoa: ler('pessoa').find((p) => p.id === item.pessoa_id) ?? { nome: item.nome, status_geral: 'ATIVO' } };
      if (nome === 'aluno') return { deleted_at: null, ...item, pessoa: ler('pessoa').find((p) => p.id === item.pessoa_id),
        matriculas_turmas: ler('matricula_turma').filter((m) => m.aluno_id === item.id).map((m) => ({ ...m, turma: hidratar('turma', ler('turma').find((t) => t.id === m.turma_id)) })),
        responsaveis: ler('aluno_responsavel').filter((r) => r.aluno_id === item.id) };
      if (nome === 'turma') return { ...item, matriculas: ler('matricula_turma').filter((m) => m.turma_id === item.id), ano_letivo: ler('ano_letivo').find((c) => c.id === item.ano_letivo_id) ?? null, ...(estado.turma_horario ? { horarios: ler('turma_horario').filter((h) => h.turma_id === item.id) } : {}) };
      if (nome === 'pessoa') return { ...item,
        aluno: ler('aluno').find((a) => a.pessoa_id === item.id) ?? null,
        funcionario: ler('funcionario').find((f) => f.pessoa_id === item.id) ?? null,
        usuario: estado.usuario ? ler('usuario').find((u) => u.pessoa_id === item.id) ?? null : null,
        alunos_responsavel: ler('aluno_responsavel').filter((r) => r.pessoa_id === item.id) };
      if (nome === 'matricula_turma') return { ...item,
        aluno: ler('aluno').find((outro) => outro.id === item.aluno_id),
        turma: hidratar('turma', ler('turma').find((outro) => outro.id === item.turma_id)) };
      if (nome === 'atendimento_clinico') return { ...item,
        aluno: hidratar('aluno', ler('aluno').find((outro) => outro.id === item.aluno_id)), profissional: hidratar('funcionario', ler('funcionario').find((p) => p.id === item.profissional_id) ?? { nome: 'Ana' }),
        sessoes: ler('atendimento_sessao').filter((outro) => outro.atendimento_clinico_id === item.id) };
      if (nome === 'atendimento_sessao') return { ...item,
        profissional: hidratar('funcionario', ler('funcionario').find((p) => p.id === item.profissional_id) ?? { nome: 'Ana' }),
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
        async groupBy({ where, by }) {
          if (by.includes('status')) {
            const grupos = new Map();
            for (const item of buscar(where)) {
              const chave = `${item.status}:${item.data_fim?.toISOString() ?? ''}`;
              const grupo = grupos.get(chave) ?? { status: item.status, data_fim: item.data_fim, _count: { _all: 0 } };
              grupo._count._all++;
              grupos.set(chave, grupo);
            }
            return [...grupos.values()];
          }
          const contagem = new Map();
          for (const item of buscar(where)) contagem.set(item.turma_id, (contagem.get(item.turma_id) ?? 0) + 1);
          return [...contagem].map(([turma_id, total]) => ({ turma_id, _count: { turma_id: total } }));
        },
        async create({ data: valores }) {
          const item = { id: sequencia++, data_fim: null, data_cancelamento: null, ...valores };
          if (nome === 'usuario' && valores.pessoa?.connect) {
            item.pessoa_id = valores.pessoa.connect.id;
            delete item.pessoa;
          }
          pendentes[nome].push(item);
          return nome === 'usuario' ? hidratar(nome, item) : { ...item };
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
          const dados = { ...valores };
          if (nome === 'usuario' && dados.pessoa?.update) {
            await resultado.pessoa.update({ where: { id: item.pessoa_id }, data: dados.pessoa.update });
            delete dados.pessoa;
          }
          atualizados[nome].set(item.id, { ...atualizados[nome].get(item.id), ...dados });
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
      if (sql.join('?').includes('pg_advisory')) return [];
      const tabela = ['turma', 'pessoa', 'funcionario', 'usuario'].find((nome) => sql.join('?').includes(`FROM "${nome}"`)) ?? 'aluno';
      const chave = `${tabela}:${id}`;
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
  assert.ok(banco.atendimento_sessao.filter((s) => s.atendimento_clinico_id === primeiro.id).every((s) => s.data_cancelamento && s.status === 'PROVISORIO'));
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
  assert.ok(banco.atendimento_sessao.every((s) => s.data_cancelamento && s.status === 'PROVISORIO'));
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

function prepararTrocaRegular(t, instante = '2026-11-02T23:00:00.000Z') {
  const banco = simularBanco(t, {
    aluno: [aluno(1, 'ATIVO')], pessoa: [{ ...pessoaEdicao, status_geral: 'ATIVO' }],
    turma: [20, 21, 22].map((id) => turma(id, 'REGULAR', 5)),
    matricula_turma: [{ id: 1, aluno_id: 1, turma_id: 20, status: 'ATIVO', data_inicio: data('2026-10-01'), data_fim: null }],
  });
  banco.ano_letivo[0].data_fim = data('2027-01-31');
  t.mock.timers.setTime(new Date(instante).getTime());
  return banco;
}

for (const [cenario, instante, hoje, fimAntiga, inicioNova] of [
  ['antes da aula', '2026-11-02T10:59:00.000Z', '2026-11-02', '2026-11-01', '2026-11-02'],
  ['no início da aula', '2026-11-02T11:00:00.000Z', '2026-11-02', '2026-11-02', '2026-11-03'],
  ['durante a aula', '2026-11-02T12:00:00.000Z', '2026-11-02', '2026-11-02', '2026-11-03'],
  ['às 20h', '2026-11-02T23:00:00.000Z', '2026-11-02', '2026-11-02', '2026-11-03'],
  ['quando UTC já está no dia seguinte', '2026-11-03T01:00:00.000Z', '2026-11-02', '2026-11-02', '2026-11-03'],
  ['na virada do mês', '2026-11-30T23:00:00.000Z', '2026-11-30', '2026-11-30', '2026-12-01'],
  ['na virada do ano', '2026-12-31T23:00:00.000Z', '2026-12-31', '2026-12-31', '2027-01-01'],
]) {
  test(`troca regular ${cenario} respeita vigência e preserva a turma correta na agenda`, async (t) => {
    const banco = prepararTrocaRegular(t, instante);
    await editarAlunoService(1, { turma_id: 21 });
    assert.equal(banco.matricula_turma[0].status, 'INATIVO');
    assert.deepEqual(banco.matricula_turma[0].data_fim, data(fimAntiga));
    assert.equal(banco.matricula_turma[1].status, 'ATIVO');
    assert.deepEqual(banco.matricula_turma[1].data_inicio, data(inicioNova));
    const agenda = await obterAgendaAlunoService(1, hoje);
    const eventosHoje = agenda.eventos.filter((e) => e.data === hoje && e.tipo === 'REGULAR');
    assert.deepEqual(eventosHoje.map((e) => e.turma_id), [inicioNova === hoje ? 21 : 20]);
    const agendaNova = await obterAgendaAlunoService(1, inicioNova);
    assert.deepEqual(agendaNova.eventos.filter((e) => e.data === inicioNova && e.tipo === 'REGULAR').map((e) => e.turma_id), [21]);
  });
}

test('duas trocas após a aula não antecipam a terceira turma nem apagam a turma de hoje', async (t) => {
  const banco = prepararTrocaRegular(t);
  await editarAlunoService(1, { turma_id: 21 });
  await editarAlunoService(1, { turma_id: 22 });
  assert.equal(banco.matricula_turma[1].status, 'INATIVO');
  assert.deepEqual(banco.matricula_turma[2].data_inicio, data('2026-11-03'));
  const agenda = await obterAgendaAlunoService(1, '2026-11-02');
  assert.deepEqual(agenda.eventos.filter((e) => e.data === '2026-11-02' && e.tipo === 'REGULAR').map((e) => e.turma_id), [20]);
  assert.deepEqual(agenda.eventos.filter((e) => e.data === '2026-11-03' && e.tipo === 'REGULAR').map((e) => e.turma_id), [22]);
  assert.equal(agenda.eventos.some((e) => e.turma_id === 21), false);
});

test('troca na sexta inicia vigência no sábado e exibe nova turma somente na segunda', async (t) => {
  const banco = prepararTrocaRegular(t, '2026-11-06T23:00:00.000Z');
  await editarAlunoService(1, { turma_id: 21 });
  assert.deepEqual(banco.matricula_turma[1].data_inicio, data('2026-11-07'));
  const semana = await obterAgendaAlunoService(1, '2026-11-06');
  assert.deepEqual(semana.eventos.filter((e) => e.data === '2026-11-06' && e.tipo === 'REGULAR').map((e) => e.turma_id), [20]);
  assert.equal(semana.eventos.some((e) => e.turma_id === 21), false);
  const seguinte = await obterAgendaAlunoService(1, '2026-11-09');
  assert.deepEqual(seguinte.eventos.filter((e) => e.data === '2026-11-09' && e.tipo === 'REGULAR').map((e) => e.turma_id), [21]);
});

test('troca mantém uma data de início futura já programada', async (t) => {
  const banco = prepararTrocaRegular(t);
  banco.matricula_turma[0].data_inicio = data('2026-11-10');
  await editarAlunoService(1, { turma_id: 21 });
  assert.deepEqual(banco.matricula_turma[1].data_inicio, data('2026-11-10'));
  assert.equal((await obterAgendaAlunoService(1, '2026-11-02')).eventos.length, 0);
});

test('nova turma lotada reverte o encerramento e mantém a agenda original', async (t) => {
  const banco = prepararTrocaRegular(t);
  banco.turma.find((v) => v.id === 21).capacidade_maxima = 0;
  const antes = JSON.stringify(banco);
  await assert.rejects(() => editarAlunoService(1, { turma_id: 21 }), { isConflict: true });
  assert.equal(JSON.stringify(banco), antes);
  assert.deepEqual((await obterAgendaAlunoService(1, '2026-11-02')).eventos.filter((e) => e.data === '2026-11-02' && e.tipo === 'REGULAR').map((e) => e.turma_id), [20]);
});

test('primeira matrícula sem turma anterior continua iniciando hoje, mesmo após o horário', async (t) => {
  const banco = prepararTrocaRegular(t);
  banco.matricula_turma = [];
  await editarAlunoService(1, { turma_id: 21 });
  assert.deepEqual(banco.matricula_turma[0].data_inicio, data('2026-11-02'));
});

test('troca de turma em rascunho mantém a nova matrícula provisória sem data inicial', async (t) => {
  const banco = prepararTrocaRegular(t);
  banco.aluno[0].status = 'RASCUNHO';
  banco.pessoa[0].status_geral = 'INATIVO';
  banco.matricula_turma[0].status = 'PROVISORIO';
  banco.matricula_turma[0].data_inicio = null;
  await editarAlunoService(1, { turma_id: 21 });
  assert.equal(banco.matricula_turma[1].status, 'PROVISORIO');
  assert.equal(banco.matricula_turma[1].data_inicio, null);
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
  assert.ok(banco.atendimento_sessao.slice(1).every((s) => s.status === 'INATIVO' && s.data_cancelamento));
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

async function prepararEdicaoAtendimento(t, status = 'ATIVO', configuracao = {}) {
  const banco = simularBanco(t, { aluno: [aluno(1, status)], pessoa: [pessoaEdicao], turma: [turma(10, 'OFICINA', 5)] });
  const atendimento = await agendarAtendimentoService({ ...pedidoClinico, tipo_recorrencia: 'SEMANAL', frequencia: 1,
    dias_semana: [1, 3], data_termino: '2026-11-16', ...configuracao });
  return { banco, atendimento, params: { aluno_id: 1, atendimento_id: atendimento.id } };
}

test('editar eventual antes do início atualiza sessão e profissional sem conflito consigo mesmo', async (t) => {
  const { banco, params } = await prepararEdicaoAtendimento(t, 'ATIVO', { tipo_recorrencia: 'EVENTUAL' });
  const id = banco.atendimento_sessao[0].id;
  await editarAtendimentoService(params, { hora_inicio: '10:30', duracao_minutos: 45, profissional_id: 2 });
  assert.equal(banco.atendimento_sessao.length, 1);
  assert.equal(banco.atendimento_sessao[0].id, id);
  assert.equal(banco.atendimento_sessao[0].hora_inicio.toISOString().slice(11,16), '10:30');
  assert.equal(banco.atendimento_sessao[0].profissional_id, 2);
  assert.equal(banco.atendimento_clinico[0].profissional_id, 2);
});

for (const status of ['ATIVO', 'RASCUNHO']) {
  test(`${status}: eventual iniciado não pode ser editado e aluno não pode ser trocado`, async (t) => {
    const { banco, params } = await prepararEdicaoAtendimento(t, status, { tipo_recorrencia: 'EVENTUAL' });
    await assert.rejects(() => editarAtendimentoService(params, { aluno_id: 2 }), { name: 'ZodError' });
    t.mock.timers.setTime(new Date('2026-11-02T12:30:00.000Z').getTime());
    await assert.rejects(() => editarAtendimentoService(params, { profissional_id: 2 }), { statusCode: 409 });
    assert.equal(banco.atendimento_sessao[0].profissional_id, 1);
    assert.equal((await obterAtendimentoService(params)).pode_editar, false);
  });

  test(`${status}: editar recorrência preserva sessão iniciada e cancela dias removidos com data`, async (t) => {
    const { banco, params } = await prepararEdicaoAtendimento(t, status);
    const primeira = structuredClone(banco.atendimento_sessao[0]);
    t.mock.timers.setTime(new Date('2026-11-02T12:45:00.000Z').getTime());
    await editarAtendimentoService(params, { profissional_id: 2, hora_inicio: '11:00', duracao_minutos: 45, dias_semana: [1, 2], data_termino: '2026-11-17' });
    assert.deepEqual(banco.atendimento_sessao.find((s) => s.id === primeira.id), primeira);
    const quartas = banco.atendimento_sessao.filter((s) => s.data_sessao.getUTCDay() === 3);
    assert.ok(quartas.every((s) => s.data_cancelamento && s.status === (status === 'ATIVO' ? 'INATIVO' : 'PROVISORIO')));
    const novas = banco.atendimento_sessao.filter((s) => !s.data_cancelamento && s.id !== primeira.id);
    assert.ok(novas.every((s) => s.profissional_id === 2 && s.hora_inicio.toISOString().slice(11,16) === '11:00' && s.duracao_minutos === 45));
    assert.equal(banco.atendimento_sessao.filter((s) => !s.data_cancelamento && s.data_sessao.getTime() === primeira.data_sessao.getTime()).length, 1);
    const agenda = await obterAgendaAlunoService(1);
    assert.equal(agenda.eventos.find((e) => e.sessao_id === primeira.id).profissional, 'Ana');
    assert.ok(agenda.eventos.some((e) => e.profissional === 'Bruno'));
    if (status === 'RASCUNHO') assert.ok(banco.atendimento_sessao.every((s) => s.status === 'PROVISORIO'));
  });

  test(`${status}: cancelamento preenche data em todas as sessões futuras, preserva passado e é idempotente`, async (t) => {
    const { banco, params } = await prepararEdicaoAtendimento(t, status);
    const primeira = structuredClone(banco.atendimento_sessao[0]);
    t.mock.timers.setTime(new Date('2026-11-02T12:45:00.000Z').getTime());
    await cancelarAtendimentoService(params);
    assert.ok(banco.atendimento_clinico[0].data_cancelamento);
    assert.equal(banco.atendimento_clinico[0].status, status === 'ATIVO' ? 'INATIVO' : 'PROVISORIO');
    assert.deepEqual(banco.atendimento_sessao[0], primeira);
    assert.ok(banco.atendimento_sessao.slice(1).every((s) => s.data_cancelamento && s.status === (status === 'ATIVO' ? 'INATIVO' : 'PROVISORIO')));
    assert.equal((await obterAgendaAlunoService(1, '2026-11-09')).eventos.length, 0);
    const depois = structuredClone(banco.atendimento_clinico[0]);
    t.mock.timers.setTime(new Date('2026-11-03T16:00:00.000Z').getTime());
    await cancelarAtendimentoService(params);
    assert.deepEqual(banco.atendimento_clinico[0], depois);
    await assert.rejects(() => editarAtendimentoService(params, { profissional_id: 2 }), { statusCode: 409 });
  });
}

for (const [antes, depois] of [['SEMANAL', 'MENSAL'], ['MENSAL', 'SEMANAL']]) {
  test(`converte ${antes} para ${depois} antes da primeira sessão e bloqueia após início`, async (t) => {
    const { banco, params } = await prepararEdicaoAtendimento(t, 'RASCUNHO', { tipo_recorrencia: antes, dias_semana: [1], data_termino: '2026-12-02' });
    await editarAtendimentoService(params, { tipo_recorrencia: depois, frequencia: 1, dias_semana: depois === 'SEMANAL' ? [1,3] : [] });
    assert.equal(banco.atendimento_clinico[0].tipo_recorrencia, depois);
    assert.ok(banco.atendimento_sessao.every((s) => s.status === 'PROVISORIO'));
    t.mock.timers.setTime(new Date('2026-11-02T12:45:00.000Z').getTime());
    await assert.rejects(() => editarAtendimentoService(params, { tipo_recorrencia: antes }), { statusCode: 409 });
    await assert.rejects(() => editarAtendimentoService(params, { modalidade: 'Outra' }), { statusCode: 409 });
    await assert.rejects(() => editarAtendimentoService(params, { data_inicio: '2026-11-03' }), { statusCode: 409 });
  });
}

for (const tipo_recorrencia of ['SEMANAL', 'MENSAL']) {
  test(`${tipo_recorrencia}: frequência pode mudar após início sem deslocar sessões passadas`, async (t) => {
    const { banco, params } = await prepararEdicaoAtendimento(t, 'ATIVO', { tipo_recorrencia, dias_semana: [1], data_termino: '2027-02-02' });
    const primeira = structuredClone(banco.atendimento_sessao[0]);
    t.mock.timers.setTime(new Date('2026-11-02T12:45:00.000Z').getTime());
    await editarAtendimentoService(params, { frequencia: 2 });
    assert.deepEqual(banco.atendimento_sessao[0], primeira);
    assert.equal(banco.atendimento_clinico[0].frequencia, 2);
    assert.ok(banco.atendimento_sessao.some((s) => s.data_cancelamento));
    assert.deepEqual(banco.atendimento_clinico[0].data_inicio, data('2026-11-02'));
  });
}

test('eventual não vira recorrente nem recorrente vira eventual', async (t) => {
  const { params } = await prepararEdicaoAtendimento(t);
  await assert.rejects(() => editarAtendimentoService(params, { tipo_recorrencia: 'EVENTUAL' }), { statusCode: 400 });
});

test('conflito ao editar horário impede todas as alterações e preserva IDs e sessões', async (t) => {
  const { banco, params } = await prepararEdicaoAtendimento(t, 'ATIVO', { tipo_recorrencia: 'EVENTUAL', hora_inicio: '11:00' });
  await matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] });
  const antes = structuredClone({ atendimento: banco.atendimento_clinico, sessoes: banco.atendimento_sessao });
  await assert.rejects(() => editarAtendimentoService(params, { hora_inicio: '09:15', profissional_id: 2 }), { isConflict: true });
  assert.deepEqual(banco.atendimento_clinico, antes.atendimento);
  assert.deepEqual(banco.atendimento_sessao, antes.sessoes);
});

test('edição de duração valida conflitos com outra clínica e não sobrepõe sessões da própria recorrência', async (t) => {
  const { banco, params } = await prepararEdicaoAtendimento(t, 'ATIVO', { tipo_recorrencia: 'EVENTUAL' });
  await agendarAtendimentoService({ ...pedidoClinico, hora_inicio: '11:00' });
  await assert.rejects(() => editarAtendimentoService(params, { duracao_minutos: 120 }), { isConflict: true });
  assert.equal(banco.atendimento_sessao[0].duracao_minutos, 30);
});

test('provisórios retirados por edição não conflitam nem são promovidos na ativação', async (t) => {
  const { banco, params } = await prepararEdicaoAtendimento(t, 'RASCUNHO');
  await editarAtendimentoService(params, { dias_semana: [1] });
  const canceladas = banco.atendimento_sessao.filter((s) => s.data_cancelamento).map((s) => s.id);
  await editarAlunoService(1, { status: 'ATIVO' });
  assert.ok(banco.atendimento_sessao.filter((s) => canceladas.includes(s.id)).every((s) => s.status === 'PROVISORIO' && s.data_cancelamento));
  assert.ok(banco.atendimento_sessao.filter((s) => !canceladas.includes(s.id)).every((s) => s.status === 'ATIVO'));
});

test('conversão exige os parâmetros do novo tipo e profissional precisa estar ativo', async (t) => {
  const { banco, params } = await prepararEdicaoAtendimento(t);
  await assert.rejects(() => editarAtendimentoService(params, { tipo_recorrencia: 'MENSAL' }), { statusCode: 400 });
  await assert.rejects(() => editarAtendimentoService(params, { profissional_id: 999 }), { statusCode: 404 });
  assert.equal(banco.atendimento_clinico[0].profissional_id, 1);
});

test('término pode encurtar ou estender o futuro sem excluir o passado', async (t) => {
  const { banco, params } = await prepararEdicaoAtendimento(t);
  const primeira = structuredClone(banco.atendimento_sessao[0]);
  t.mock.timers.setTime(new Date('2026-11-02T12:45:00.000Z').getTime());
  await editarAtendimentoService(params, { data_termino: '2026-11-04' });
  assert.ok(banco.atendimento_sessao.filter((s) => s.data_sessao > data('2026-11-04')).every((s) => s.status === 'INATIVO' && s.data_cancelamento));
  await editarAtendimentoService(params, { data_termino: '2026-11-18' });
  assert.deepEqual(banco.atendimento_sessao[0], primeira);
  const futuras = banco.atendimento_sessao.filter((s) => !s.data_cancelamento);
  assert.ok(futuras.some((s) => s.data_sessao.getTime() === data('2026-11-18').getTime()));
  assert.equal(new Set(futuras.map((s) => s.data_sessao.toISOString())).size, futuras.length);
});

test('edição e cancelamento concorrentes não deixam sessões vigentes em atendimento cancelado', async (t) => {
  const { banco, params } = await prepararEdicaoAtendimento(t);
  await Promise.allSettled([editarAtendimentoService(params, { frequencia: 2 }), cancelarAtendimentoService(params)]);
  assert.equal(banco.atendimento_clinico[0].status, 'INATIVO');
  assert.ok(banco.atendimento_sessao.every((s) => s.data_cancelamento && s.status === 'INATIVO'));
});

test('rotas de atendimento exigem administração, validam entrada e protegem propriedade do aluno', async (t) => {
  const express = require('express');
  const { createServer } = require('node:http');
  const routes = require('../routes/atendimentosRoutes');
  const { params } = await prepararEdicaoAtendimento(t);
  const app = express(); app.use(express.json());
  app.use('/api', (req, res, next) => { if (req.get('x-test-role')) req.usuario = { role: req.get('x-test-role') }; next(); }, routes);
  const server = createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `/api/alunos/1/atendimentos/${params.atendimento_id}`;
  for (const [method, caminho, role, body, esperado] of [['GET', base, null, undefined, 401], ['PATCH', base, 'professor', { hora_inicio: '10:30' }, 403],
    ['PATCH', base, 'admin', { aluno_id: 2 }, 400], ['PATCH', base, 'admin', {}, 400], ['GET', base.replace('/alunos/1', '/alunos/2'), 'admin', undefined, 404],
    ['GET', base, 'admin', undefined, 200], ['PATCH', base, 'admin', { hora_inicio: '10:30' }, 200], ['PATCH', base + '/cancelamento', 'admin', undefined, 200],
    ['PATCH', base, 'admin', { hora_inicio: '11:00' }, 409]]) {
    const resposta = await fetch(`http://127.0.0.1:${server.address().port}${caminho}`, { method,
      headers: { 'content-type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal(resposta.status, esperado);
  }
});

test('falha ao criar sessão durante edição desfaz atualização de sessões e atendimento', async (t) => {
  const { banco, params } = await prepararEdicaoAtendimento(t);
  const antes = structuredClone({ atendimento: banco.atendimento_clinico, sessoes: banco.atendimento_sessao });
  const transacao = prisma.$transaction;
  prisma.$transaction = (operacao, options) => transacao(async (tx) => {
    tx.atendimento_sessao.create = async () => { throw new Error('Falha simulada ao inserir sessão'); };
    return operacao(tx);
  }, options);
  await assert.rejects(() => editarAtendimentoService(params, { dias_semana: [1, 2], hora_inicio: '11:00', profissional_id: 2 }), /Falha simulada/);
  assert.deepEqual(banco.atendimento_clinico, antes.atendimento);
  assert.deepEqual(banco.atendimento_sessao, antes.sessoes);
});

test('edição rejeita sessões da própria recorrência que se sobrepõem', async (t) => {
  const { params } = await prepararEdicaoAtendimento(t);
  await assert.rejects(() => editarAtendimentoService(params, { dias_semana: [1, 2], duracao_minutos: 1500 }), (erro) => {
    return erro.isConflict && erro.detalhes.some((c) => c.codigo === 'CHOQUE_SESSOES_RECORRENCIA');
  });
});

for (const tipo of ['REGULAR', 'OFICINA']) {
  test(`${tipo}: inativação encerra planejamento sem promovê-lo e libera a edição e ativação do aluno`, async (t) => {
    const banco = simularBanco(t, { pessoa: [pessoaEdicao], turma: [turma(10, tipo, 5)] });
    if (tipo === 'REGULAR') await matricularTurmaRegularService({ aluno_id: 1, turma_id: 10 });
    else await matricularOficinasService({ aluno_id: 1, oficinas_ids: [10] });
    const matricula = structuredClone(banco.matricula_turma[0]);
    await editarTurmaService(10, { status: 'INATIVO', confirmar_cancelamentos: { matriculas: [matricula.id], matriculas_ativas: 0 } });
    assert.equal(banco.matricula_turma[0].status, 'PROVISORIO');
    assert.ok(banco.matricula_turma[0].data_fim);
    assert.equal((await obterAgendaAlunoService(1)).eventos.length, 0);
    if (tipo === 'REGULAR') {
      await assert.rejects(() => matricularTurmaRegularService({ aluno_id: 2, turma_id: 10 }), { statusCode: 400 });
      const detalhe = await obterAlunoService(1);
      assert.equal(detalhe.turma_regular, null);
      await editarAlunoService(1, { nome: 'Nome editado' });
    } else {
      await assert.rejects(() => matricularOficinasService({ aluno_id: 2, oficinas_ids: [10] }), { isConflict: true });
      const oficinas = await obterOficinasService(1);
      assert.equal(oficinas.length, 0);
      await editarAlunoService(1, { dias_frequencia: [2] });
    }
    await editarAlunoService(1, { status: 'ATIVO' });
    assert.equal(banco.aluno[0].status, 'ATIVO');
    await editarTurmaService(10, { status: 'ATIVO' });
    assert.equal((await obterAgendaAlunoService(1)).eventos.length, 0);
    assert.equal(banco.matricula_turma[0].status, 'PROVISORIO');
  });
}

test('listagem e detalhe não retornam vínculo regular encerrado pela inativação da turma', async (t) => {
  const banco = simularBanco(t, { pessoa: [pessoaEdicao], turma: [turma(20, 'REGULAR', 5)] });
  await matricularTurmaRegularService({ aluno_id: 1, turma_id: 20 });
  await editarTurmaService(20, { status: 'INATIVO', confirmar_cancelamentos: { matriculas: [banco.matricula_turma[0].id], matriculas_ativas: 0 } });
  const detalhe = await obterAlunoService(1);
  const consulta = t.mock.fn(async ({ include }) => {
    assert.equal(include.matriculas_turmas.select.turma.select.status, true);
    return [{ ...banco.aluno[0], pessoa: pessoaEdicao, responsaveis: [], matriculas_turmas: [] }];
  });
  prisma.aluno.findMany = consulta;
  const [listado] = await listarAlunosService();
  assert.equal(listado.turma_regular, null);
  assert.deepEqual(listado.turma_regular, detalhe.turma_regular);
});

for (const primeiro of ['inativar', 'ativar_aluno']) {
  test(`concorrência com ${primeiro} primeiro não ativa vínculos encerrados nem cancela matrículas sem nova confirmação`, async (t) => {
    const banco = simularBanco(t, { pessoa: [pessoaEdicao], turma: [turma(20, 'REGULAR', 5)] });
    await matricularTurmaRegularService({ aluno_id: 1, turma_id: 20 });
    const inativar = () => editarTurmaService(20, { status: 'INATIVO', confirmar_cancelamentos: { matriculas: [banco.matricula_turma[0].id], matriculas_ativas: 0 } });
    let liberar, sinalizar;
    const pronto = new Promise((resolve) => { sinalizar = resolve; });
    const continuar = new Promise((resolve) => { liberar = resolve; });
    const barreira = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "turma" WHERE "id" = ${20} FOR UPDATE`;
      sinalizar(); await continuar;
    });
    await pronto;
    const operacoes = primeiro === 'inativar'
      ? [inativar, () => editarAlunoService(1, { status: 'ATIVO' })]
      : [() => editarAlunoService(1, { status: 'ATIVO' }), inativar];
    const primeira = operacoes[0]().then((value) => ({ status: 'fulfilled', value }), (reason) => ({ status: 'rejected', reason }));
    await new Promise(setImmediate);
    const segunda = operacoes[1]().then((value) => ({ status: 'fulfilled', value }), (reason) => ({ status: 'rejected', reason }));
    liberar(); await barreira;
    assert.equal((await primeira).status, 'fulfilled');
    assert.equal((await segunda).status, primeiro === 'inativar' ? 'fulfilled' : 'rejected');
    assert.equal(banco.turma[0].status, primeiro === 'inativar' ? 'INATIVO' : 'ATIVO');
    assert.equal(banco.matricula_turma[0].status, primeiro === 'inativar' ? 'PROVISORIO' : 'ATIVO');
  });
}

function turmaParaEncerramento(tipo = 'REGULAR') {
  return {
    pessoa: [pessoaEdicao, { id: 2, nome: 'Aluno Ativo', status_geral: 'ATIVO' }],
    turma: [turma(10, tipo, 5), turma(20, 'REGULAR', 5)],
    matricula_turma: [
      { id: 50, aluno_id: 2, turma_id: 10, status: 'ATIVO', data_inicio: data('2026-10-01'), data_fim: null },
      { id: 51, aluno_id: 1, turma_id: 10, status: 'PROVISORIO', data_inicio: null, data_fim: null },
      { id: 52, aluno_id: 3, turma_id: 10, status: 'INATIVO', data_inicio: data('2026-09-01'), data_fim: data('2026-10-01') },
      { id: 53, aluno_id: 3, turma_id: 20, status: 'ATIVO', data_inicio: data('2026-10-01'), data_fim: null },
    ],
  };
}

for (const tipo of ['REGULAR', 'OFICINA']) {
  for (const acao of ['inativar', 'excluir']) {
    test(`${acao} ${tipo} exige confirmação, encerra todos os vínculos e preserva calendário histórico e demais turmas`, async (t) => {
      const inicial = turmaParaEncerramento(tipo);
      const banco = simularBanco(t, inicial);
      const executar = (dados) => acao === 'excluir' ? excluirTurmaService(10, dados) : editarTurmaService(10, { status: 'INATIVO', ...dados });
      await assert.rejects(() => executar({}), (erro) => {
        assert.equal(erro.statusCode, 409);
        assert.deepEqual(erro.confirmacao, { matriculas: [50, 51], matriculas_ativas: 1 });
        return true;
      });
      assert.equal(banco.turma[0].status, 'ATIVO');
      assert.deepEqual(banco.matricula_turma, inicial.matricula_turma);
      await executar({ confirmar_cancelamentos: { matriculas: [50, 51], matriculas_ativas: 1 } });
      assert.equal(banco.turma[0].status, 'INATIVO');
      assert.equal(Boolean(banco.turma[0].deleted_at), acao === 'excluir');
      assert.equal(banco.matricula_turma[0].status, 'INATIVO');
      assert.equal(banco.matricula_turma[0].data_fim.toISOString().slice(0, 10), '2026-11-02');
      assert.equal(banco.matricula_turma[1].status, 'PROVISORIO');
      assert.ok(banco.matricula_turma[1].data_fim);
      assert.deepEqual(banco.matricula_turma.slice(2), inicial.matricula_turma.slice(2));
      const historico = await obterAgendaAlunoService(2, '2026-11-02');
      assert.deepEqual(historico.eventos.map((e) => e.data), ['2026-11-02']);
      assert.equal((await obterAgendaAlunoService(2, '2026-11-09')).eventos.length, 0);
      assert.equal((await obterAgendaAlunoService(1, '2026-10-26')).eventos.length, 0);
      assert.equal((await obterAlunoService(2)).turma_regular, null);
      assert.equal((await obterOficinasService(2)).length, 0);
      if (acao === 'excluir') {
        assert.equal((await listarTurmasService()).some((item) => item.id === 10), false);
        assert.equal(await obterTurmaService(10), null);
        await assert.rejects(() => editarTurmaService(10, { status: 'ATIVO' }), { statusCode: 404 });
        await assert.rejects(() => excluirTurmaService(10, { confirmar_cancelamentos: { matriculas: [], matriculas_ativas: 0 } }), { statusCode: 404 });
      } else {
        await editarTurmaService(10, { status: 'ATIVO' });
        assert.equal((await obterAgendaAlunoService(2, '2026-11-09')).eventos.length, 0);
        assert.equal(banco.matricula_turma[0].status, 'INATIVO');
      }
      if (tipo === 'REGULAR') await assert.rejects(() => matricularTurmaRegularService({ aluno_id: 1, turma_id: acao === 'excluir' ? 10 : 999 }), { statusCode: 400 });
    });
  }
}

test('encerramento da turma antes do horário preserva somente até ontem', async (t) => {
  const inicial = turmaParaEncerramento();
  inicial.turma[0].horarios.forEach((h) => { h.hora_inicio = hora('10:00'); });
  const banco = simularBanco(t, inicial);
  await editarTurmaService(10, { status: 'INATIVO', confirmar_cancelamentos: { matriculas: [50, 51], matriculas_ativas: 1 } });
  assert.equal(banco.matricula_turma[0].data_fim.toISOString().slice(0, 10), '2026-11-01');
  assert.equal((await obterAgendaAlunoService(2, '2026-11-02')).eventos.length, 0);
  assert.ok((await obterAgendaAlunoService(2, '2026-10-26')).eventos.length);
});

test('exclusão exige confirmação mesmo sem matrículas e preserva os dados da turma', async (t) => {
  const banco = simularBanco(t, { turma: [turma(10)] });
  const antes = structuredClone(banco.turma[0]);
  await assert.rejects(() => excluirTurmaService(10), { statusCode: 409 });
  await excluirTurmaService(10, { confirmar_cancelamentos: { matriculas: [], matriculas_ativas: 0 } });
  const { deleted_at, status, ...dados } = banco.turma[0];
  assert.ok(deleted_at);
  assert.equal(status, 'INATIVO');
  const { status: statusAnterior, ...anteriores } = antes;
  assert.equal(statusAnterior, 'ATIVO');
  assert.deepEqual(dados, anteriores);
});

test('mudança dos vínculos ou da quantidade efetiva exige nova confirmação sem cancelar parcialmente', async (t) => {
  const banco = simularBanco(t, turmaParaEncerramento());
  for (const confirmacao of [{ matriculas: [50], matriculas_ativas: 1 }, { matriculas: [50, 51], matriculas_ativas: 0 }]) {
    await assert.rejects(() => excluirTurmaService(10, { confirmar_cancelamentos: confirmacao }), { statusCode: 409 });
    assert.equal(banco.matricula_turma[0].status, 'ATIVO');
    assert.equal(banco.matricula_turma[1].data_fim, null);
  }
});

test('falha na alteração da turma reverte todos os encerramentos', async (t) => {
  const banco = simularBanco(t, turmaParaEncerramento());
  const antes = structuredClone(banco);
  const transacao = prisma.$transaction;
  prisma.$transaction = (operacao, opcoes) => transacao((tx) => {
    tx.turma.update = async () => { throw new Error('Falha na turma'); };
    return operacao(tx);
  }, opcoes);
  await assert.rejects(() => excluirTurmaService(10, { confirmar_cancelamentos: { matriculas: [50, 51], matriculas_ativas: 1 } }), /Falha na turma/);
  assert.deepEqual(banco, antes);
});

test('repetir inativação não altera datas finais e repara matrícula inativa sem data final', async (t) => {
  const inicial = turmaParaEncerramento();
  inicial.matricula_turma.push({ id: 54, aluno_id: 3, turma_id: 10, status: 'INATIVO', data_inicio: data('2026-10-01'), data_fim: null });
  const banco = simularBanco(t, inicial);
  await editarTurmaService(10, { status: 'INATIVO', confirmar_cancelamentos: { matriculas: [50, 51], matriculas_ativas: 1 } });
  const encerradas = structuredClone(banco.matricula_turma);
  assert.ok(encerradas.at(-1).data_fim);
  await editarTurmaService(10, { status: 'INATIVO' });
  assert.deepEqual(banco.matricula_turma, encerradas);
});

for (const acao of ['cancelar oficina', 'inativar aluno', 'excluir aluno']) {
  test(`${acao} também preenche data final de matrícula já inativa sem encerramento`, async (t) => {
    const inicial = turmaParaEncerramento('OFICINA');
    inicial.matricula_turma[0].status = 'INATIVO';
    const banco = simularBanco(t, inicial);
    if (acao === 'cancelar oficina') await cancelarOficinaService({ aluno_id: 2, matricula_id: 50 });
    else if (acao === 'inativar aluno') await alterarStatusAlunoService(2, { status: 'INATIVO' });
    else await excluirAlunoService(2);
    assert.equal(banco.matricula_turma[0].status, 'INATIVO');
    assert.ok(banco.matricula_turma[0].data_fim);
  });
}

test('DELETE de turma exige administração, valida entrada, solicita confirmação e oculta a excluída', async (t) => {
  simularBanco(t, turmaParaEncerramento());
  const express = require('express'), { createServer } = require('node:http');
  const { turmaAdminRoutes, turmaLeituraRoutes } = require('../routes/turmaRoutes');
  const app = express(); app.use(express.json());
  app.use('/api', (req, res, next) => { if (req.get('x-role')) req.usuario = { role: req.get('x-role') }; next(); }, turmaAdminRoutes, turmaLeituraRoutes);
  const server = createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/turmas`;
  const excluir = (id, role, body) => fetch(`${base}/${id}`, { method: 'DELETE', headers: { 'content-type': 'application/json', ...(role ? { 'x-role': role } : {}) }, body: JSON.stringify(body ?? {}) });
  assert.equal((await excluir(10)).status, 401);
  assert.equal((await excluir(10, 'professor')).status, 403);
  assert.equal((await excluir('abc', 'admin')).status, 400);
  assert.equal((await excluir(10, 'admin', { deleted_at: '2026-11-02' })).status, 400);
  const pendente = await excluir(10, 'admin');
  assert.equal(pendente.status, 409);
  const { confirmacao } = await pendente.json();
  assert.equal((await excluir(10, 'admin', { confirmar_cancelamentos: confirmacao })).status, 204);
  assert.equal((await fetch(`${base}/10`, { headers: { 'x-role': 'admin' } })).status, 404);
});

for (const primeiro of ['inativar', 'matricular']) {
  test(`nova matrícula concorrente com ${primeiro} primeiro não escapa do encerramento confirmado`, async (t) => {
    const inicial = turmaParaEncerramento();
    inicial.aluno = [aluno(1), aluno(2, 'ATIVO'), aluno(3, 'ATIVO'), aluno(4, 'ATIVO')];
    const banco = simularBanco(t, inicial);
    let liberar, sinalizar;
    const bloqueada = new Promise((resolve) => { sinalizar = resolve; });
    const continuar = new Promise((resolve) => { liberar = resolve; });
    const barreira = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "turma" WHERE "id" = ${10} FOR UPDATE`;
      sinalizar(); await continuar;
    });
    await bloqueada;
    const inativar = () => editarTurmaService(10, { status: 'INATIVO', confirmar_cancelamentos: { matriculas: [50, 51], matriculas_ativas: 1 } });
    const matricular = () => matricularTurmaRegularService({ aluno_id: 4, turma_id: 10 });
    const operacoes = primeiro === 'inativar' ? [inativar, matricular] : [matricular, inativar];
    const iniciar = (operacao) => operacao().then((value) => ({ status: 'fulfilled', value }), (reason) => ({ status: 'rejected', reason }));
    const primeira = iniciar(operacoes[0]);
    await new Promise(setImmediate);
    const segunda = iniciar(operacoes[1]);
    liberar(); await barreira;
    assert.equal((await primeira).status, 'fulfilled');
    assert.equal((await segunda).status, 'rejected');
    if (primeiro === 'inativar') {
      assert.equal(banco.turma[0].status, 'INATIVO');
      assert.equal(banco.matricula_turma.some((m) => m.aluno_id === 4), false);
    } else {
      assert.equal(banco.turma[0].status, 'ATIVO');
      assert.equal(banco.matricula_turma.find((m) => m.id === 50).status, 'ATIVO');
      assert.equal((await segunda).reason.statusCode, 409);
    }
  });
}

function planejamentoNovaTurma() {
  const alunos = Array.from({ length: 9 }, (_, indice) => ({ ...aluno(indice + 1, 'ATIVO'), participa_procan: indice === 0 }));
  alunos[3].turno = 'TARDE';
  alunos[4].status = 'INATIVO';
  alunos[5].status = 'RASCUNHO';
  alunos[6].deleted_at = data('2026-10-01');
  return {
    aluno: alunos, pessoa: alunos.map((a) => ({ id: a.id, nome: `Aluno ${a.id}`, status_geral: 'ATIVO' })),
    turma: [{ ...turma(10, 'REGULAR', 3), status: 'INATIVO', ambiente_id: 2, ano_letivo_id: 2026, descricao: 'Descrição da origem' }, turma(20, 'REGULAR', 20)],
    ambiente: [{ id: 2, nome: 'Sala' }], turma_horario: [],
    matricula_turma: [
      { id: 50, aluno_id: 1, turma_id: 10, status: 'INATIVO', data_inicio: data('2026-01-01'), data_fim: data('2026-11-01') },
      { id: 51, aluno_id: 2, turma_id: 10, status: 'PROVISORIO', data_inicio: data('2026-01-01'), data_fim: data('2026-11-01') },
      { id: 52, aluno_id: 8, turma_id: 20, status: 'ATIVO', data_inicio: data('2026-01-01'), data_fim: null },
      { id: 53, aluno_id: 9, turma_id: 20, status: 'ATIVO', data_inicio: data('2026-01-01'), data_fim: null },
      { id: 54, aluno_id: 9, turma_id: 10, status: 'INATIVO', data_inicio: data('2026-01-01'), data_fim: data('2026-10-01') },
    ],
  };
}

const pedidoNovaTurma = { turma: { tipo: 'REGULAR', nome: 'Girassol 2027', turno: 'MANHA', ano_letivo_id: 2027,
  ambiente_id: 2, profissional_id: 1, capacidade_maxima: 3, descricao: 'Nova descrição' }, alunos_ids: [1, 3] };

test('preparação não grava, filtra turno/status/vínculo ativo e sinaliza somente antigos alunos efetivados', async (t) => {
  const banco = simularBanco(t, planejamentoNovaTurma());
  const antes = structuredClone(banco);
  const manha = await prepararNovaTurmaService(10);
  assert.deepEqual(manha.alunos.map((a) => a.id), [1, 2, 3]);
  assert.deepEqual(manha.alunos[0], { id: 1, nome: 'Aluno 1', participa_procan: true, ano_anterior: true });
  assert.equal(manha.alunos[1].ano_anterior, false);
  assert.deepEqual((await prepararNovaTurmaService(10, 'TARDE')).alunos.map((a) => a.id), [4]);
  assert.deepEqual(banco, antes);
});

test('nova turma cria cinco horários e matrículas efetivas no início do calendário sem modificar a origem ou seu histórico', async (t) => {
  const banco = simularBanco(t, planejamentoNovaTurma());
  const anteriores = structuredClone(banco.matricula_turma), origem = structuredClone(banco.turma[0]);
  const nova = await criarTurmaAPartirService(10, pedidoNovaTurma);
  assert.notEqual(nova.id, 10);
  assert.equal(nova.status, 'ATIVO');
  assert.equal(nova.nome, 'Girassol 2027');
  assert.equal(nova.ano_letivo_id, 2027);
  assert.equal(nova.horarios.length, 5);
  assert.equal(nova.horarios.find((h) => h.dia_semana === 3).hora_inicio.toISOString().slice(11, 16), '12:30');
  const novas = banco.matricula_turma.filter((m) => m.turma_id === nova.id);
  assert.deepEqual(novas.map((m) => m.aluno_id), [1, 3]);
  assert.ok(novas.every((m) => m.status === 'ATIVO' && m.data_inicio.toISOString() === '2027-02-08T00:00:00.000Z'));
  assert.deepEqual(banco.turma[0], origem);
  assert.deepEqual(banco.matricula_turma.filter((m) => m.turma_id !== nova.id), anteriores);
  assert.equal((await obterAgendaAlunoService(1, '2026-12-28')).eventos.some((e) => e.turma_id === nova.id && e.data < '2027-01-01'), false);
  assert.equal((await obterAgendaAlunoService(1, '2027-01-04')).eventos.some((e) => e.turma_id === nova.id), false);
  assert.ok((await obterAgendaAlunoService(1, '2027-02-08')).eventos.some((e) => e.turma_id === nova.id));
});

test('turno alterado usa somente candidatos compatíveis e gera o cronograma da tarde', async (t) => {
  simularBanco(t, planejamentoNovaTurma());
  const nova = await criarTurmaAPartirService(10, { turma: { ...pedidoNovaTurma.turma, turno: 'TARDE' }, alunos_ids: [4] });
  assert.ok(nova.horarios.every((h) => h.hora_inicio.toISOString().slice(11, 16) === '12:30'));
});

for (const caso of ['ATIVA', 'OFICINA', 'EXCLUIDA', 'INEXISTENTE']) {
  test(`nova turma rejeita origem ${caso} tanto na preparação quanto na criação`, async (t) => {
    const inicial = planejamentoNovaTurma();
    if (caso === 'ATIVA') inicial.turma[0].status = 'ATIVO';
    if (caso === 'OFICINA') inicial.turma[0].tipo = 'OFICINA';
    if (caso === 'EXCLUIDA') inicial.turma[0].deleted_at = data('2026-11-01');
    if (caso === 'INEXISTENTE') inicial.turma = [];
    const banco = simularBanco(t, inicial);
    const antes = structuredClone(banco);
    const statusCode = ['EXCLUIDA', 'INEXISTENTE'].includes(caso) ? 404 : 409;
    await assert.rejects(() => prepararNovaTurmaService(10), { statusCode });
    await assert.rejects(() => criarTurmaAPartirService(10, pedidoNovaTurma), { statusCode });
    assert.deepEqual(banco, antes);
  });
}

for (const id of [4, 5, 6, 7, 8, 999]) {
  test(`aluno indisponível ${id} impede criação sem gravação parcial`, async (t) => {
    const banco = simularBanco(t, planejamentoNovaTurma());
    const antes = structuredClone(banco);
    await assert.rejects(() => criarTurmaAPartirService(10, { ...pedidoNovaTurma, alunos_ids: [1, id] }), { statusCode: 409 });
    assert.deepEqual(banco, antes);
  });
}

test('capacidade insuficiente bloqueia e ausência de limite ou de alunos permite criar', async (t) => {
  const banco = simularBanco(t, planejamentoNovaTurma());
  await assert.rejects(() => criarTurmaAPartirService(10, { ...pedidoNovaTurma, turma: { ...pedidoNovaTurma.turma, capacidade_maxima: 1 } }), { statusCode: 409 });
  const { capacidade_maxima, ...semLimite } = pedidoNovaTurma.turma;
  assert.equal(capacidade_maxima, 3);
  const nova = await criarTurmaAPartirService(10, { turma: semLimite, alunos_ids: [1, 2, 3] });
  assert.equal(banco.matricula_turma.filter((m) => m.turma_id === nova.id).length, 3);
  const vazia = await criarTurmaAPartirService(10, { ...pedidoNovaTurma, alunos_ids: [] });
  assert.equal(banco.matricula_turma.some((m) => m.turma_id === vazia.id), false);
});

test('falha ao matricular após criar turma e horários reverte toda a operação', async (t) => {
  const banco = simularBanco(t, planejamentoNovaTurma());
  const antes = structuredClone(banco), transacao = prisma.$transaction;
  prisma.$transaction = (operacao, opcoes) => transacao((tx) => {
    const criar = tx.matricula_turma.create;
    tx.matricula_turma.create = (args) => {
      if (args.data.aluno_id === 3) throw new Error('Falha na segunda matrícula');
      return criar(args);
    };
    return operacao(tx);
  }, opcoes);
  await assert.rejects(() => criarTurmaAPartirService(10, pedidoNovaTurma), /Falha na segunda matrícula/);
  assert.deepEqual(banco, antes);
});

test('profissional inativo ou sala inexistente impede criar a nova turma', async (t) => {
  const inicial = planejamentoNovaTurma();
  inicial.pessoa.push({ id: 10, nome: 'Profissional inativo', status_geral: 'INATIVO' });
  const banco = simularBanco(t, inicial), antes = structuredClone(banco);
  await assert.rejects(() => criarTurmaAPartirService(10, pedidoNovaTurma), { statusCode: 400 });
  assert.deepEqual(banco, antes);
  banco.pessoa.find((p) => p.id === 10).status_geral = 'ATIVO';
  await assert.rejects(() => criarTurmaAPartirService(10, { ...pedidoNovaTurma, turma: { ...pedidoNovaTurma.turma, ambiente_id: 999 } }), { statusCode: 404 });
  assert.equal(banco.turma.length, 2);
});

test('validação de frequência da matrícula regular reverte turma, horários e matrículas já criadas', async (t) => {
  const inicial = planejamentoNovaTurma();
  inicial.aluno[2].dias_frequencia = [6];
  const banco = simularBanco(t, inicial), antes = structuredClone(banco);
  await assert.rejects(() => criarTurmaAPartirService(10, pedidoNovaTurma), { isConflict: true });
  assert.deepEqual(banco, antes);
});

test('duas criações concorrentes não matriculam o mesmo aluno em duas turmas regulares', async (t) => {
  const banco = simularBanco(t, planejamentoNovaTurma());
  const resultados = await Promise.allSettled([criarTurmaAPartirService(10, pedidoNovaTurma), criarTurmaAPartirService(10, pedidoNovaTurma)]);
  assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(resultados.find((r) => r.status === 'rejected').reason.statusCode, 409);
  assert.equal(banco.turma.length, 3);
  assert.equal(banco.matricula_turma.filter((m) => m.aluno_id === 1 && m.status === 'ATIVO').length, 1);
});

test('endpoints de nova turma exigem administração e validam campos e alunos duplicados', async (t) => {
  simularBanco(t, planejamentoNovaTurma());
  const express = require('express'), { createServer } = require('node:http');
  const { turmaAdminRoutes } = require('../routes/turmaRoutes');
  const app = express(); app.use(express.json());
  app.use('/api', (req, res, next) => { if (req.get('x-role')) req.usuario = { role: req.get('x-role') }; next(); }, turmaAdminRoutes);
  const server = createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/turmas/10/nova-turma`;
  for (const method of ['GET', 'POST']) for (const [role, esperado] of [['', 401], ['professor', 403]]) {
    assert.equal((await fetch(base, { method, headers: role ? { 'x-role': role } : {} })).status, esperado);
  }
  assert.equal((await fetch(`${base}?turno=INVALIDO`, { headers: { 'x-role': 'admin' } })).status, 400);
  const consulta = await fetch(`${base}?turno=TARDE`, { headers: { 'x-role': 'admin' } });
  assert.equal(consulta.status, 200);
  assert.deepEqual((await consulta.json()).alunos.map((a) => a.id), [4]);
  const post = (body) => fetch(base, { method: 'POST', headers: { 'x-role': 'admin', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  for (const body of [{ ...pedidoNovaTurma, alunos_ids: [1, 1] }, { ...pedidoNovaTurma, alunos_ids: ['1'] },
    { ...pedidoNovaTurma, turma: { ...pedidoNovaTurma.turma, ano_letivo_id: 10000 } }, { ...pedidoNovaTurma, turma: { ...pedidoNovaTurma.turma, ano_letivo_id: undefined } }]) {
    assert.equal((await post(body)).status, 400);
  }
  assert.equal((await post(pedidoNovaTurma)).status, 201);
});
