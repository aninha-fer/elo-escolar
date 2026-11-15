import { api } from './api';

export const atendimentosService = {
  async buscarPorId(alunoId, atendimentoId) {
    const { data } = await api.get(`/alunos/${Number(alunoId)}/atendimentos/${Number(atendimentoId)}`);
    return data;
  },
  async editar(alunoId, atendimentoId, dados) {
    const { data } = await api.patch(`/alunos/${Number(alunoId)}/atendimentos/${Number(atendimentoId)}`, dados);
    return data;
  },
  async cancelar(alunoId, atendimentoId) {
    const { data } = await api.patch(`/alunos/${Number(alunoId)}/atendimentos/${Number(atendimentoId)}/cancelamento`);
    return data;
  },
  async criar(dadosAtendimento, signal) {
    const response = await api.post('/atendimentos', dadosAtendimento, { signal });
    return response.data;
  },

  async removerProvisorio(id, atendimentoId, signal) {
    const response = await api.delete(`/alunos/${Number(id)}/atendimentos/${Number(atendimentoId)}/provisorio`, { signal });
    return response.data;
  },
};
