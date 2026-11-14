import { api } from './api';

export const usuariosService = {
    async listarTodos(signal) {
        const { data } = await api.get('/usuarios', { signal });
        return data;
    },
    async criar(dadosUsuario) {
        const { data } = await api.post('/usuarios', dadosUsuario);
        return data;
    },
};
