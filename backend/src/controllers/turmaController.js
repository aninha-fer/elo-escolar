const { listarTurmasQueryDTO } = require('../dtos/turmaDTO');
const { listarTurmasService } = require('../services/turmaService');

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

module.exports = { listarTurmas };