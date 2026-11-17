const dto = require('../dtos/ocorrenciaDTO');
const service = require('../services/ocorrenciaService');

function tratarErro(error, res) {
    if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
    if ([400, 404, 409].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message });
    if (error.code === 'P2025') return res.status(404).json({ erro: 'Ocorrência não encontrada.' });
    console.error('Erro ao processar ocorrência.', { nome: error.name, codigo: error.code });
    return res.status(500).json({ erro: 'Não foi possível processar a ocorrência.' });
}

async function listarOcorrencias(req, res) {
    try {
        const { aluno_id } = dto.alunoParamsDTO.parse(req.params);
        return res.status(200).json(await service.listarOcorrenciasService(aluno_id));
    } catch (error) { return tratarErro(error, res); }
}

async function criarOcorrencia(req, res) {
    try {
        const { aluno_id } = dto.alunoParamsDTO.parse(req.params);
        const dados = dto.criarOcorrenciaDTO.parse(req.body);
        return res.status(201).json(await service.criarOcorrenciaService(aluno_id, req.usuario.id, dados));
    } catch (error) { return tratarErro(error, res); }
}

async function editarOcorrencia(req, res) {
    try {
        const { aluno_id, ocorrencia_id } = dto.ocorrenciaParamsDTO.parse(req.params);
        const dados = dto.editarOcorrenciaDTO.parse(req.body);
        return res.status(200).json(await service.editarOcorrenciaService(aluno_id, ocorrencia_id, dados));
    } catch (error) { return tratarErro(error, res); }
}

async function excluirOcorrencia(req, res) {
    try {
        const { aluno_id, ocorrencia_id } = dto.ocorrenciaParamsDTO.parse(req.params);
        await service.excluirOcorrenciaService(aluno_id, ocorrencia_id);
        return res.status(204).send();
    } catch (error) { return tratarErro(error, res); }
}

module.exports = { listarOcorrencias, criarOcorrencia, editarOcorrencia, excluirOcorrencia };
