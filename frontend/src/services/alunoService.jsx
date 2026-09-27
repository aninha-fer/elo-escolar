import { api } from './api';

export const alunoService = {
  /**
   * Busca a lista de alunos com suporte a filtro e cancelamento de requisição
   * @param {Object} params - Filtros como { nome, status, pagina }
   * @param {AbortSignal} signal - Token de cancelamento
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

  async buscarAgendaPorId(id, signal) {
    const response = await api.get(`/alunos/${id}/agenda`, { signal });
    return response.data;
  }
};