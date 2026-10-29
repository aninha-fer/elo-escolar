const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { criarAlunoDTO } = require('../dtos/alunoDTO');
const { criarAlunoService, listarAlunosService, obterAlunoService } = require('./alunoService');
const { criarAluno } = require('../controllers/alunoController');

const dadosBase = { nome: 'Aluno Teste', turno: 'MANHA', dias_frequencia: [1, 2], status: 'RASCUNHO' };

function simularCadastro(t, { falharResponsavel = false, falharMedicos = false } = {}) {
  const banco = { pessoa: [], aluno: [], aluno_responsavel: [], aluno_dados_medicos: [] };
  const original = prisma.$transaction;
  let sequencia = 1;
  t.after(() => { prisma.$transaction = original; });
  prisma.$transaction = t.mock.fn(async (operacao) => {
    const pendentes = structuredClone(banco);
    const tx = {};
    for (const nome of Object.keys(banco)) tx[nome] = { create: async ({ data, select }) => {
      if (nome === 'aluno_responsavel' && falharResponsavel) throw new Error('Falha no responsável');
      if (nome === 'aluno_dados_medicos' && falharMedicos) throw new Error('Falha nos dados médicos');
      const registro = { ...(nome !== 'aluno_dados_medicos' ? { id: sequencia++ } : {}), ...data };
      pendentes[nome].push(registro);
      return select ? Object.fromEntries(Object.keys(select).map((campo) => [campo, registro[campo]])) : registro;
    } };
    const retorno = await operacao(tx);
    Object.assign(banco, pendentes);
    return retorno;
  });
  return banco;
}

function resposta() {
  return { status(codigo) { this.statusCode = codigo; return this; }, json(body) { this.body = body; return this; } };
}

test('campos adicionais podem ser omitidos e Procan tem padrão falso', async (t) => {
  const banco = simularCadastro(t);
  const dados = criarAlunoDTO.parse(dadosBase);
  assert.equal(dados.participa_procan, false);
  assert.deepEqual(dados.responsaveis, []);
  const criado = await criarAlunoService(dados);
  assert.equal(criado.participa_procan, false);
  assert.equal(criado.observacoes, null);
  assert.equal(criado.dados_medicos, null);
  assert.equal(banco.aluno_responsavel.length, 0);
  assert.equal(banco.aluno_dados_medicos.length, 0);
});

test('cadastro grava vários responsáveis, Procan, observações e dados médicos em uma transação', async (t) => {
  const banco = simularCadastro(t);
  const res = resposta();
  await criarAluno({ body: { ...dadosBase, participa_procan: true, observacoes: ' Apoio na rotina ',
    responsaveis: [
      { nome: ' Ana Teste ', parentesco: ' Mãe ', telefone: '11999999999' },
      { nome: 'Roberto Teste', parentesco: 'Pai' }
    ],
    dados_medicos: { restricao_alimentar: ' Lactose ', autorizado_atividade_fisica: false,
      usa_medicamento: true, medicamentos_descricao: ' Medicamento informado ', autorizacao_analgesico: 'AMBOS' }
  } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(prisma.$transaction.mock.callCount(), 1);
  assert.equal(banco.pessoa.length, 3);
  assert.equal(banco.pessoa[0].status_geral, 'INATIVO');
  assert.ok(banco.pessoa.slice(1).every((pessoa) => pessoa.status_geral === 'ATIVO'));
  assert.equal(banco.aluno[0].status, 'RASCUNHO');
  assert.equal(banco.aluno[0].participa_procan, true);
  assert.equal(banco.aluno[0].observacoes, 'Apoio na rotina');
  assert.deepEqual(res.body.responsaveis.map((item) => [item.nome, item.parentesco, item.telefone]),
    [['Ana Teste', 'Mãe', '11999999999'], ['Roberto Teste', 'Pai', null]]);
  assert.ok(banco.aluno_responsavel.every((item) => item.aluno_id === banco.aluno[0].id));
  assert.ok(banco.aluno_responsavel.every((item) => item.pessoa_id !== banco.aluno[0].pessoa_id));
  assert.equal(res.body.dados_medicos.autorizado_atividade_fisica, false);
  assert.equal(res.body.dados_medicos.autorizacao_analgesico, 'AMBOS');
  assert.equal(res.body.dados_medicos.medicamentos_descricao, 'Medicamento informado');
});

for (const valor of [undefined, null, false, true]) {
  test(`booleanos médicos preservam ${valor}`, () => {
    const dados = criarAlunoDTO.parse({ ...dadosBase, dados_medicos: {
      autorizado_atividade_fisica: valor, usa_medicamento: valor,
      ...(valor === true ? { medicamentos_descricao: 'Descrição' } : {})
    } });
    assert.equal(dados.dados_medicos.autorizado_atividade_fisica, valor ?? null);
    assert.equal(dados.dados_medicos.usa_medicamento, valor ?? null);
  });
}

for (const valor of [null, 'NENHUM', 'PARACETAMOL', 'DIPIRONA', 'AMBOS']) {
  test(`autorização para analgésicos preserva ${valor}`, () => {
    assert.equal(criarAlunoDTO.parse({ ...dadosBase, dados_medicos: { autorizacao_analgesico: valor } })
      .dados_medicos.autorizacao_analgesico, valor);
  });
}

test('dados médicos vazios não criam registro, mas a resposta explícita "não" cria', async (t) => {
  const banco = simularCadastro(t);
  await criarAlunoService(criarAlunoDTO.parse({ ...dadosBase, dados_medicos: {
    restricao_alimentar: '  ', autorizado_atividade_fisica: null, usa_medicamento: null,
    medicamentos_descricao: '', autorizacao_analgesico: null
  } }));
  assert.equal(banco.aluno_dados_medicos.length, 0);
  const criado = await criarAlunoService(criarAlunoDTO.parse({ ...dadosBase, dados_medicos: { usa_medicamento: false } }));
  assert.equal(banco.aluno_dados_medicos.length, 1);
  assert.equal(criado.dados_medicos.usa_medicamento, false);
  assert.equal(criado.dados_medicos.autorizado_atividade_fisica, null);
});

test('não usa medicamento limpa a descrição e textos opcionais vazios são normalizados', () => {
  const dados = criarAlunoDTO.parse({ ...dadosBase, observacoes: ' ',
    dados_medicos: { usa_medicamento: false, medicamentos_descricao: 'Texto antigo', restricao_alimentar: '' } });
  assert.equal(dados.observacoes, undefined);
  assert.equal(dados.dados_medicos.medicamentos_descricao, null);
  assert.equal(dados.dados_medicos.restricao_alimentar, null);
});

for (const [nome, adicionais, caminho] of [
  ['medicamento sem descrição', { dados_medicos: { usa_medicamento: true } }, ['dados_medicos', 'medicamentos_descricao']],
  ['medicamento com descrição vazia', { dados_medicos: { usa_medicamento: true, medicamentos_descricao: ' ' } }, ['dados_medicos', 'medicamentos_descricao']],
  ['responsável sem nome', { responsaveis: [{ parentesco: 'Mãe' }] }, ['responsaveis', 0, 'nome']],
  ['parentesco com 31 caracteres', { responsaveis: [{ nome: 'Teste', parentesco: 'a'.repeat(31) }] }, ['responsaveis', 0, 'parentesco']],
  ['telefone inválido', { responsaveis: [{ nome: 'Teste', telefone: 'abcdefghij' }] }, ['responsaveis', 0, 'telefone']],
  ['booleano como string', { dados_medicos: { usa_medicamento: 'false' } }, ['dados_medicos', 'usa_medicamento']],
  ['Procan como string', { participa_procan: 'false' }, ['participa_procan']],
  ['analgésico desconhecido', { dados_medicos: { autorizacao_analgesico: 'OUTRO' } }, ['dados_medicos', 'autorizacao_analgesico']]
]) {
  test(`API rejeita ${nome} sem gravar`, async (t) => {
    simularCadastro(t);
    const res = resposta();
    await criarAluno({ body: { ...dadosBase, ...adicionais } }, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.erros.some((erro) => JSON.stringify(erro.path) === JSON.stringify(caminho)));
    assert.equal(prisma.$transaction.mock.callCount(), 0);
  });
}

test('parentesco com 30 caracteres é aceito e responsável pode omitir telefone e parentesco', () => {
  const dados = criarAlunoDTO.parse({ ...dadosBase, responsaveis: [{ nome: 'Teste', parentesco: 'a'.repeat(30) }, { nome: 'Outro' }] });
  assert.equal(dados.responsaveis[0].parentesco.length, 30);
  assert.equal(dados.responsaveis[1].telefone, undefined);
});

test('erro interno não retorna nem registra o conteúdo dos dados médicos', async (t) => {
  const original = prisma.$transaction;
  t.after(() => { prisma.$transaction = original; });
  prisma.$transaction = t.mock.fn(async () => { throw new Error('Informação médica privada sobre a turma'); });
  const log = t.mock.method(console, 'error', () => {});
  const res = resposta();
  await criarAluno({ body: { ...dadosBase, dados_medicos: { restricao_alimentar: 'Informação médica privada' } } }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.erro, 'Erro interno no servidor.');
  assert.doesNotMatch(JSON.stringify(log.mock.calls.map((chamada) => chamada.arguments)), /privada|restricao_alimentar/);
});

for (const falha of ['falharResponsavel', 'falharMedicos']) {
  test(`falha em ${falha} reverte aluno, pessoas e vínculos`, async (t) => {
    const banco = simularCadastro(t, { [falha]: true });
    const dados = criarAlunoDTO.parse({ ...dadosBase, responsaveis: [{ nome: 'Responsável' }],
      dados_medicos: { usa_medicamento: false } });
    await assert.rejects(() => criarAlunoService(dados), /Falha/);
    assert.ok(Object.values(banco).every((itens) => itens.length === 0));
  });
}

test('listagem usa resumo de responsáveis e Procan, sem dados médicos, observações ou telefone do responsável', async (t) => {
  const originalLista = prisma.aluno.findMany;
  const originalDetalhe = prisma.aluno.findUnique;
  t.after(() => { prisma.aluno.findMany = originalLista; prisma.aluno.findUnique = originalDetalhe; });
  const registro = { id: 1, pessoa: { nome: 'Aluno' }, status: 'RASCUNHO', turno: 'MANHA', dias_frequencia: [1],
    participa_procan: true, observacoes: 'Observações', matriculas_turmas: [],
    responsaveis: [{ id: 2, pessoa_id: 3, parentesco: 'Mãe', pessoa: { nome: 'Ana', telefone: '11999999999' } }],
    dados_medicos: { restricao_alimentar: 'Restrição', usa_medicamento: false, autorizado_atividade_fisica: null, autorizacao_analgesico: 'NENHUM' } };
  prisma.aluno.findMany = t.mock.fn(async () => [registro]);
  prisma.aluno.findUnique = t.mock.fn(async () => registro);
  const [resumo] = await listarAlunosService();
  assert.equal(resumo.participa_procan, true);
  assert.equal(resumo.responsaveis[0].nome, 'Ana');
  assert.equal(resumo.responsaveis[0].telefone, undefined);
  assert.equal(resumo.dados_medicos, undefined);
  assert.equal(resumo.observacoes, undefined);
  assert.equal(prisma.aluno.findMany.mock.calls[0].arguments[0].include.dados_medicos, undefined);
  const detalhe = await obterAlunoService(1);
  assert.equal(detalhe.responsaveis[0].telefone, '11999999999');
  assert.equal(detalhe.dados_medicos.usa_medicamento, false);
  assert.equal(detalhe.dados_medicos.autorizado_atividade_fisica, null);
  assert.equal(detalhe.dados_medicos.autorizacao_analgesico, 'NENHUM');
  assert.equal(detalhe.observacoes, 'Observações');
});
