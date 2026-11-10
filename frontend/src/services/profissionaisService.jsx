import { api } from './api';

function normalizarProfissional(profissional) {
    return {
        id: profissional.id,
        nome: profissional.nome,
        telefone: profissional.telefone,
        funcao: profissional.funcao ?? profissional.cargo,
        status_geral: profissional.status_geral,
    };
}

export const profissionaisService = {
    async listarTodos(signal) {
        const { data } = await api.get('/profissionais', { signal });
        return data.map(normalizarProfissional);
    },
    async criar(dadosProfissional) {
        const { data } = await api.post('/profissionais', dadosProfissional);
        return normalizarProfissional(data);
    },
};
