const { criarAtendimentoDTO } = require('../dtos/atendimentoDTO');
const { agendarAtendimentoService, listarProfissionaisAtendimentoService } = require('../services/atendimentoService');

async function criarAtendimento(req, res) {
  try {
    const dadosValidados = criarAtendimentoDTO.parse(req.body);
    const atendimento = await agendarAtendimentoService(dadosValidados);

    return res.status(201).json(atendimento);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ erros: error.issues });
    }
    if (error.isConflict) {
      return res.status(409).json({ erro: error.message, conflitos: error.detalhes });
    }
    if (error.statusCode === 400 || error.statusCode === 404) {
      return res.status(error.statusCode).json({ erro: error.message });
    }

    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao criar atendimento.' });
  }
}

async function listarProfissionais(req, res) {
  try {
    const profissionais = await listarProfissionaisAtendimentoService();
    return res.status(200).json(profissionais);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao listar profissionais.' });
  }
}

module.exports = { criarAtendimento, listarProfissionais };
