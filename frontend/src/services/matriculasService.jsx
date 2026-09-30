import { api } from './api';

export const matriculasService = {
  /**
   * @param {Object} params - Filtros
   * @param {AbortSignal} signal - Token de cancelamento
   */

  async matricularOficina(id, oficinasIds, signal) {
    const alunoId = Number(id);

    if (!Number.isInteger(alunoId) || alunoId <= 0) {
      throw new Error('ID do aluno inválido.');
    }

    const response = await api.post(
        '/matriculas/oficinas',
        {
            aluno_id: alunoId,
            oficinas_ids: oficinasIds,
        },
        { signal },
    );
    return response.data;
  },
};