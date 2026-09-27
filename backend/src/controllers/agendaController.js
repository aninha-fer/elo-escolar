const { getAgendaAlunoDTO } = require('../dtos/alunoDTO');
const { obterAgendaAlunoService } = require('../services/agendaService');

async function obterAgenda(req, res) {
  try {
    const { id } = getAgendaAlunoDTO.parse(req.params);
    
    const agenda = await obterAgendaAlunoService(id);
    
    return res.status(200).json(agenda);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ erros: error.errors });
    }
    
    if (error.status) {
      return res.status(error.status).json({ erro: error.message });
    }
    
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao buscar agenda.' });
  }
}

module.exports = { obterAgenda };