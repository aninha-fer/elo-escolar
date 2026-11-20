import { api } from './api';

export const alunoService = {
  async selecionarCalendarios(filtros, signal) {
    return (await api.get('/alunos/exportacao/selecionados', { params: filtros, signal })).data;
  },
  async buscarCalendariosLote(ids, referencia, signal) {
    return (await api.get('/alunos/exportacao/calendarios', { params: { ids: ids.join(','), referencia }, signal })).data;
  },
  async buscarCalendarioExportacao(id, signal) {
    return (await api.get(`/alunos/${id}/calendario-exportacao`, { signal })).data;
  },
  async excluir(id) {
    await api.delete(`/alunos/${id}`);
  },
  async alterarStatus(id, status) {
    const { data } = await api.patch(`/alunos/${id}/status`, { status });
    return data;
  },
  async editar(id, dadosAluno) {
    const { data } = await api.patch(`/alunos/${id}`, dadosAluno);
    return data;
  },
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

  async buscarAgendaPorId(id, signal, data) {
    const response = await api.get(`/alunos/${id}/agenda`, { signal, params: { data: data || undefined } });
    return response.data;
  },

  async buscarOficinasPorId(id, signal, params) {
    const response = await api.get(`/alunos/${id}/oficinas`, { signal, params });
    return response.data;
  },

  async buscarAtendimentosPorId(id, signal, params) {
    const response = await api.get(`/alunos/${id}/atendimentos`, { signal, params });
    return response.data;
  },
};
