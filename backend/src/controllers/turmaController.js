const { listarTurmasQueryDTO, listarTurmasRegularesQueryDTO, criarTurmaDTO } = require('../dtos/turmaDTO');
const { listarTurmasService, listarTurmasRegularesPorTurnoService, criarTurmaService } = require('../services/turmaService');

async function listarTurmas(req, res) {
  try {
    const queryValidada = listarTurmasQueryDTO.parse(req.query);
    const turmas = await listarTurmasService(queryValidada.tipo);
    return res.status(200).json(turmas);
  } catch (error) {
    console.error(error);
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
    if ([400, 404].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message });
    console.error('Erro ao cadastrar turma.', { nome: error.name, codigo: error.code });
    return res.status(500).json({ erro: 'Erro interno ao cadastrar turma.' });
  }
}

module.exports = { listarTurmas, listarTurmasRegularesPorTurno, criarTurma };
