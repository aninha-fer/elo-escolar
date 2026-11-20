const { getAlunoDTO } = require('../dtos/alunoDTO');
const { filtrosExportacaoDTO, loteExportacaoDTO } = require('../dtos/exportacaoCalendarioDTO');
const { selecionarExportacaoService, obterCalendariosExportacaoService } = require('../services/exportacaoCalendarioService');

function responderErro(res, erro) {
    if (erro.name === 'ZodError') return res.status(400).json({ erros: erro.issues });
    if (erro.statusCode === 404) return res.status(404).json({ erro: erro.message });
    console.error('Erro ao exportar calendário.', { codigo: erro.code, nome: erro.name });
    return res.status(500).json({ erro: 'Não foi possível carregar os dados para exportação.' });
}
async function selecionar(req, res) {
    try { return res.json(await selecionarExportacaoService(filtrosExportacaoDTO.parse(req.query))); }
    catch (erro) { return responderErro(res, erro); }
}
async function lote(req, res) {
    try { const { ids, referencia } = loteExportacaoDTO.parse(req.query); return res.json(await obterCalendariosExportacaoService(ids, referencia)); }
    catch (erro) { return responderErro(res, erro); }
}
async function individual(req, res) {
    try { const { id } = getAlunoDTO.parse(req.params); return res.json((await obterCalendariosExportacaoService([id]))[0]); }
    catch (erro) { return responderErro(res, erro); }
}
module.exports = { selecionar, lote, individual };
