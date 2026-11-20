const { criarModalidadeDTO } = require('../dtos/modalidadeDTO');
const { lerPaginacao } = require('../dtos/paginacaoDTO');
const { listarModalidadesService, criarModalidadeService } = require('../services/modalidadeService');

function responderErro(res, erro) {
    if (erro.name === 'ZodError') return res.status(400).json({ erros: erro.issues });
    if (erro.statusCode === 409) return res.status(409).json({ erro: erro.message });
    console.error('Erro ao processar modalidade.', { codigo: erro.code, nome: erro.name });
    return res.status(500).json({ erro: 'Não foi possível processar a modalidade.' });
}

async function listar(req, res) {
    try { return res.json(await listarModalidadesService(lerPaginacao(req.query))); }
    catch (erro) { return responderErro(res, erro); }
}

async function criar(req, res) {
    try { return res.status(201).json(await criarModalidadeService(criarModalidadeDTO.parse(req.body))); }
    catch (erro) { return responderErro(res, erro); }
}

module.exports = { listar, criar };
