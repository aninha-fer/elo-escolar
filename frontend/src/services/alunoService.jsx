import { api } from './api';

export const alunoService = {
  /**
   * @param {Object} params
   * @param {AbortSignal} signal
   */
  async listarTodos(params = {}, signal) {
    const response = await api.get('/alunos', { 
      params,
      signal
    });
    return response.data;
  },

  async buscarPorId(id, signal) {
    const response = await api.get(`/alunos/${id}`, { signal });
    return response.data;
  },

  async criarAluno(dadosAluno, signal) {
    const response = await api.post('/alunos', dadosAluno, { signal });
    return response.data;
  },

  async buscarAgendaPorId(id, signal) {
    const response = await api.get(`/alunos/${id}/agenda`, { signal });
    return response.data;
  },
};