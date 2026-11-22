import { api, conexao } from './api';

const tratarSessaoLocalmente = { tratarSessaoLocalmente: true };

export const authService = {
  async registrarAtividade(signal) {
    await api.post('/auth/atividade', undefined, { signal });
  },
  async trocarSenhaInicial(dados, signal) {
    const { data } = await api.post('/auth/primeiro-acesso/senha', dados, { ...tratarSessaoLocalmente, signal });
    return data;
  },
  async login({ email, senha }, signal) {
    const { data } = await api.post(
      '/auth/login',
      { email, senha },
      { ...tratarSessaoLocalmente, sessaoPublica: true, signal },
    );
    return data;
  },

  async obterSessao(signal) {
    return conexao.verificar({ signal });
  },

  async logout(signal) {
    await api.post('/auth/logout', undefined, { ...tratarSessaoLocalmente, sessaoPublica: true, signal });
  },
};
