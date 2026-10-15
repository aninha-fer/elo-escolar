import { api } from './api';

export const turmasService = {
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

    async listarTurmasRegularesPorTurno(signal, turno) {
      const response = await api.get('/turmas/regulares', {
        params: { turno: turno || undefined },
        signal,
      });
      return response.data;
    },
};