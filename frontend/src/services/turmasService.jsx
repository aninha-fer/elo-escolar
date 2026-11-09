import { api } from './api';

export const turmasService = {
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
