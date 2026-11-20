import { api } from './api';

export const turmasService = {
  async listarPaginadas(params, signal) {
    const { data } = await api.get('/turmas', { params, signal });
    return data;
  },
  async listarAlunosPaginados({ id, ...params }, signal) {
    const { data } = await api.get(`/turmas/${id}/alunos`, { params, signal });
    return data;
  },
  async prepararNovaTurma(id, turno, signal) {
    const { data } = await api.get(`/turmas/${id}/nova-turma`, { params: { turno }, signal });
    return data;
  },
  async criarAPartir(id, dados) {
    const { data } = await api.post(`/turmas/${id}/nova-turma`, dados);
    return data;
  },
  async excluir(id, dados) {
    await api.delete(`/turmas/${id}`, { data: dados });
  },
  async editar(id, dadosTurma) {
    const { data } = await api.patch(`/turmas/${id}`, dadosTurma);
    return data;
  },
  async buscarPorId(id, signal, params) {
    const { data } = await api.get(`/turmas/${id}`, { signal, params });
    return data;
  },

  async criar(dadosTurma) {
    const { data } = await api.post('/turmas', dadosTurma);
    return data;
  },

  /**
   * @param {Object} params
   * @param {AbortSignal} signal
   */

  async listarOficinasDisponiveis(signal) {
    const response = await api.get('/turmas', {
      params: { tipo: 'OFICINA' },
      signal,
    });
    return response.data;
  },

  async listarRegularesDisponiveis(signal) {
    const response = await api.get('/turmas', {
      params: { tipo: 'REGULAR' },
      signal,
    });
    return response.data;
  },

  async listarTurmasRegularesPorTurno(signal, turno) {
    const response = await api.get('/turmas/regulares', {
      params: { turno: turno || undefined },
      signal,
    });
    return response.data;
  },
};
