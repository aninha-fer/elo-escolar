const { criarAtendimentoDTO, removerAtendimentoProvisorioDTO, editarAtendimentoDTO } = require('../dtos/atendimentoDTO');
const { agendarAtendimentoService, removerAtendimentoProvisorioService, obterAtendimentoService, editarAtendimentoService, cancelarAtendimentoService } = require('../services/atendimentoService');

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

async function removerAtendimentoProvisorio(req, res) {
  try {
    const dados = removerAtendimentoProvisorioDTO.parse(req.params);
    return res.status(200).json(await removerAtendimentoProvisorioService(dados));
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
    if ([404, 409].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message });
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao remover o atendimento provisório.' });
  }
}

function erroOperacao(error, res) {
  if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
  if (error.isConflict) return res.status(409).json({ erro: error.message, conflitos: error.detalhes });
  if ([400, 404, 409].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message });
  console.error('Erro ao alterar atendimento.', { nome: error.name, codigo: error.code });
  return res.status(500).json({ erro: 'Não foi possível processar o atendimento.' });
}

async function obterAtendimento(req, res) {
  try { return res.status(200).json(await obterAtendimentoService(removerAtendimentoProvisorioDTO.parse(req.params))); }
  catch (error) { return erroOperacao(error, res); }
}

async function editarAtendimento(req, res) {
  try { return res.status(200).json(await editarAtendimentoService(removerAtendimentoProvisorioDTO.parse(req.params), editarAtendimentoDTO.parse(req.body))); }
  catch (error) { return erroOperacao(error, res); }
}

async function cancelarAtendimento(req, res) {
  try { return res.status(200).json(await cancelarAtendimentoService(removerAtendimentoProvisorioDTO.parse(req.params))); }
  catch (error) { return erroOperacao(error, res); }
}

module.exports = { criarAtendimento, removerAtendimentoProvisorio, obterAtendimento, editarAtendimento, cancelarAtendimento };
