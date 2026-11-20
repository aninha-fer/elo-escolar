const { anoLetivoParamsDTO } = require('../dtos/anoLetivoDTO');
const { lerPaginacao } = require('../dtos/paginacaoDTO');
const { listarAnosLetivosService, criarAnoLetivoService, editarAnoLetivoService } = require('../services/anoLetivoService');

function responderErro(res, error) {
  if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
  if (error.code === 'P2002') return res.status(409).json({ erro: 'Já existe um calendário para esse ano.' });
  if ([400, 404, 409].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message,
    ...(error.conflitos ? { conflitos: error.conflitos } : {}), ...(error.confirmacao ? { confirmacao: error.confirmacao } : {}) });
  console.error('Erro ao processar calendário letivo.', { codigo: error.code, nome: error.name });
  return res.status(500).json({ erro: 'Não foi possível processar o calendário letivo.' });
}

async function listar(req, res) {
  try { return res.json(await listarAnosLetivosService(lerPaginacao(req.query))); }
  catch (error) { return responderErro(res, error); }
}
async function criar(req, res) {
  try { return res.status(201).json(await criarAnoLetivoService(req.body)); }
  catch (error) { return responderErro(res, error); }
}
async function editar(req, res) {
  try { const { id } = anoLetivoParamsDTO.parse(req.params); return res.json(await editarAnoLetivoService(id, req.body)); }
  catch (error) { return responderErro(res, error); }
}

module.exports = { listar, criar, editar };
