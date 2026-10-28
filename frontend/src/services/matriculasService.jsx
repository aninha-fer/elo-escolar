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

  async cancelarOficina(id, matriculaId, signal) {
    const aluno_id = Number(id);
    const matricula_id = Number(matriculaId);
    if (!Number.isInteger(aluno_id) || aluno_id <= 0 || !Number.isInteger(matricula_id) || matricula_id <= 0) {
      throw new Error('Aluno ou inscrição inválidos.');
    }
    const response = await api.patch(`/matriculas/oficinas/${matricula_id}/cancelamento`, { aluno_id }, { signal });
    return response.data;
  },

  async removerProvisoria(id, matriculaId, signal) {
    const response = await api.delete(`/alunos/${Number(id)}/matriculas/${Number(matriculaId)}/provisorio`, { signal });
    return response.data;
  },
};
