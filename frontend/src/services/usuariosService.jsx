import { api } from './api';

export const usuariosService = {
    async listarPaginados(params, signal) {
        const { data } = await api.get('/usuarios', { params, signal });
        return data;
    },
    async listarTodos(signal) {
        const { data } = await api.get('/usuarios', { signal });
        return data;
    },
    async criar(dadosUsuario) {
        const { data } = await api.post('/usuarios', dadosUsuario);
        return data;
    },
    async editar(id, dadosUsuario) {
        const { data } = await api.patch(`/usuarios/${id}`, dadosUsuario);
        return data;
    },
    async excluir(id) {
        await api.delete(`/usuarios/${id}`);
    },
};
