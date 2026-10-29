import { api } from './api';

export const atendimentosService = {
  async listarProfissionais(signal) {
    const response = await api.get('/atendimentos/profissionais', { signal });
    return response.data;
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
