const { criarProfissionalDTO } = require('../dtos/profissionalDTO');
const { criarProfissionalService, listarProfissionaisService } = require('../services/profissionalService');

async function criarProfissional(req, res) {
  try {
    const dadosValidados = criarProfissionalDTO.parse(req.body);
    
    const profissional = await criarProfissionalService(dadosValidados);
    
    return res.status(201).json(profissional);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ erros: error.issues });
    }
    if (error.isConflict) return res.status(409).json({ erro: error.message, conflitos: error.detalhes });
    if ([400, 404].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message });
    console.error('Erro ao cadastrar profissional.', { nome: error.name, codigo: error.code });
    return res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
}

async function listarProfissionais(req, res) {
  try {
    const profissionais = await listarProfissionaisService();
    return res.status(200).json(profissionais);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao listar profissionais.' });
  }
}

module.exports = {
  criarProfissional,
  listarProfissionais
};