import { api } from './api';

export const anosLetivosService = {
    async listarTodos(signal) { return (await api.get('/anos-letivos', { signal })).data; },
    async listarPagina(params, signal) { return (await api.get('/anos-letivos', { params, signal })).data; },
    async criar(dados) { return (await api.post('/anos-letivos', dados)).data; },
    async editar(id, dados) { return (await api.patch(`/anos-letivos/${id}`, dados)).data; },
};
