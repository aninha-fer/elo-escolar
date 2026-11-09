import { api } from './api';

export const atendimentosService = {
  async criar(dadosAtendimento, signal) {
    const response = await api.post('/atendimentos', dadosAtendimento, { signal });
    return response.data;
  },

  async removerProvisorio(id, atendimentoId, signal) {
    const response = await api.delete(`/alunos/${Number(id)}/atendimentos/${Number(atendimentoId)}/provisorio`, { signal });
    return response.data;
  },
};
