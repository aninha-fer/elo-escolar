import { api } from './api';

export const ocorrenciasService = {
    async listar(alunoId, signal, params) {
        const { data } = await api.get(`/alunos/${Number(alunoId)}/ocorrencias`, { signal, params });
        return data;
    },
    async criar(alunoId, dados) {
        const { data } = await api.post(`/alunos/${Number(alunoId)}/ocorrencias`, dados);
        return data;
    },
    async editar(alunoId, ocorrenciaId, dados) {
        const { data } = await api.patch(`/alunos/${Number(alunoId)}/ocorrencias/${Number(ocorrenciaId)}`, dados);
        return data;
    },
    async excluir(alunoId, ocorrenciaId) {
        await api.delete(`/alunos/${Number(alunoId)}/ocorrencias/${Number(ocorrenciaId)}`);
    },
};
