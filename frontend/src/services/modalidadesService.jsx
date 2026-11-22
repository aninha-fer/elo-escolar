import { api } from './api';

export const modalidadesService = {
    async listarTodos(signal) { return (await api.get('/modalidades', { signal })).data; },
    async listarPagina(params, signal) { return (await api.get('/modalidades', { params, signal })).data; },
    async criar(dados) { return (await api.post('/modalidades', dados)).data; },
};
