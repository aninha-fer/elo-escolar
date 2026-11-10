import { api } from './api';

export const ambientesService = {
    async listarTodos(signal) {
        const { data } = await api.get('/ambientes', { signal });
        return data;
    },
};
