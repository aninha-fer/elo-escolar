const { matricularOficinasDTO } = require('../dtos/matriculaDTO');
const { matricularOficinasService } = require('../services/matriculaService');

async function criarMatriculasOficinas(req, res) {
  try {
    const dadosValidados = matricularOficinasDTO.parse(req.body);
    
    const resultado = await matricularOficinasService(dadosValidados);
    
    return res.status(201).json(resultado);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ erros: error.errors });
    }
    if (error.isConflict) {
      return res.status(409).json({ 
        erro: error.message, 
        conflitos: error.detalhes 
      });
    }
    if (error.message === 'Aluno não encontrado ou inativo.') {
        return res.status(404).json({ erro: error.message });
    }
    
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao processar matrículas.' });
  }
}

module.exports = { criarMatriculasOficinas };