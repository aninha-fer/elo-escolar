const { listarTurmasQueryDTO, listarTurmasRegularesQueryDTO, criarTurmaDTO, getTurmaDTO, editarTurmaDTO, excluirTurmaDTO, prepararNovaTurmaQueryDTO, criarTurmaAPartirDTO, detalheTurmaQueryDTO, diarioTurmaQueryDTO } = require('../dtos/turmaDTO');
const { listarTurmasService, listarTurmasRegularesPorTurnoService, criarTurmaService, obterTurmaService, editarTurmaService, excluirTurmaService, prepararNovaTurmaService, criarTurmaAPartirService, listarAlunosTurmaService, obterDiarioTurmaService } = require('../services/turmaService');
const { lerPaginacao } = require('../dtos/paginacaoDTO');

async function obterDiarioTurma(req, res) {
  try {
    const { id } = getTurmaDTO.parse(req.params);
    const { mes } = diarioTurmaQueryDTO.parse(req.query);
    return res.status(200).json(await obterDiarioTurmaService(id, mes));
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
    if ([400, 404, 409].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message });
    console.error('Erro ao consultar diário de classe.', { nome: error.name, codigo: error.code });
    return res.status(500).json({ erro: 'Não foi possível carregar o diário de classe.' });
  }
}

async function listarTurmas(req, res) {
  try {
    const queryValidada = listarTurmasQueryDTO.parse(req.query);
    const turmas = await listarTurmasService(queryValidada.tipo, lerPaginacao(req.query), queryValidada);
    return res.status(200).json(turmas);
  } catch (error) {
    console.error(error);
    if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
    if (error.statusCode === 400) return res.status(400).json({ erro: error.message });
    return res.status(500).json({ erro: 'Erro interno ao listar turmas.' });
  }
}

async function listarTurmasRegularesPorTurno(req, res) {
  try {
    const queryValidada = listarTurmasRegularesQueryDTO.parse(req.query);
    const turmas = await listarTurmasRegularesPorTurnoService(queryValidada.turno);
    return res.status(200).json(turmas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao listar turmas.' });
  }
}

async function criarTurma(req, res) {
  try {
    const dadosValidados = criarTurmaDTO.parse(req.body);
    const turma = await criarTurmaService(dadosValidados);
    return res.status(201).json(turma);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
    if ([400, 404, 409].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message });
    console.error('Erro ao cadastrar turma.', { nome: error.name, codigo: error.code });
    return res.status(500).json({ erro: 'Erro interno ao cadastrar turma.' });
  }
}

async function obterTurma(req, res) {
  try {
    const { id } = getTurmaDTO.parse(req.params);
    const { somente_dados } = detalheTurmaQueryDTO.parse(req.query ?? {});
    const turma = await obterTurmaService(id, somente_dados !== 'true');
    if (!turma) return res.status(404).json({ erro: 'Turma não encontrada.' });
    return res.status(200).json(turma);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
    console.error('Erro ao obter turma.', { nome: error.name, codigo: error.code });
    return res.status(500).json({ erro: 'Erro interno ao obter turma.' });
  }
}

async function editarTurma(req, res) {
  try {
    const { id } = getTurmaDTO.parse(req.params);
    const dados = editarTurmaDTO.parse(req.body);
    return res.status(200).json(await editarTurmaService(id, dados));
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
    if ([400, 404, 409].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message,
      ...(error.confirmacao ? { confirmacao: error.confirmacao, matriculas_ativas: error.matriculas_ativas } : {}) });
    console.error('Erro ao editar turma.', { nome: error.name, codigo: error.code });
    return res.status(500).json({ erro: 'Erro interno ao editar turma.' });
  }
}

async function excluirTurma(req, res) {
  try {
    const { id } = getTurmaDTO.parse(req.params);
    const dados = excluirTurmaDTO.parse(req.body ?? {});
    await excluirTurmaService(id, dados);
    return res.status(204).send();
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
    if ([400, 404, 409].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message,
      ...(error.confirmacao ? { confirmacao: error.confirmacao, matriculas_ativas: error.matriculas_ativas } : {}) });
    console.error('Erro ao excluir turma.', { nome: error.name, codigo: error.code });
    return res.status(500).json({ erro: 'Erro interno ao excluir turma.' });
  }
}

function responderErroNovaTurma(res, error) {
  if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
  if (error.isConflict) return res.status(409).json({ erro: error.message, conflitos: error.detalhes });
  if ([400, 404, 409].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message });
  console.error('Erro ao criar turma a partir de outra.', { nome: error.name, codigo: error.code });
  return res.status(500).json({ erro: 'Erro interno ao preparar ou criar a nova turma.' });
}

async function prepararNovaTurma(req, res) {
  try {
    const { id } = getTurmaDTO.parse(req.params);
    const { turno } = prepararNovaTurmaQueryDTO.parse(req.query);
    return res.status(200).json(await prepararNovaTurmaService(id, turno));
  } catch (error) { return responderErroNovaTurma(res, error); }
}

async function criarTurmaAPartir(req, res) {
  try {
    const { id } = getTurmaDTO.parse(req.params);
    const dados = criarTurmaAPartirDTO.parse(req.body);
    return res.status(201).json(await criarTurmaAPartirService(id, dados));
  } catch (error) { return responderErroNovaTurma(res, error); }
}

async function listarAlunosTurma(req, res) {
  try {
    const { id } = getTurmaDTO.parse(req.params);
    const paginacao = lerPaginacao({ ...req.query, paginado: 'true' });
    return res.status(200).json(await listarAlunosTurmaService(id, paginacao));
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
    if ([400, 404].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message });
    console.error('Erro ao listar alunos da turma.', { nome: error.name, codigo: error.code });
    return res.status(500).json({ erro: 'Não foi possível carregar os alunos da turma.' });
  }
}

module.exports = { listarTurmas, listarTurmasRegularesPorTurno, criarTurma, obterTurma, editarTurma, excluirTurma, prepararNovaTurma, criarTurmaAPartir, listarAlunosTurma, obterDiarioTurma };
