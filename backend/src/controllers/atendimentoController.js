const { criarAtendimentoDTO } = require('../dtos/atendimentoDTO');
const { agendarAtendimentoService } = require('../services/atendimentoService');

async function criarAtendimento(req, res) {
  try {
    const dadosValidados = criarAtendimentoDTO.parse(req.body);
    const atendimento = await agendarAtendimentoService(dadosValidados);

    return res.status(201).json(atendimento);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ erros: error.issues });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({ erro: error.message });
    }

    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao criar atendimento.' });
  }
}

module.exports = { criarAtendimento };
