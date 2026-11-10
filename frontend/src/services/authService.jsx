import { api } from './api';

const tratarSessaoLocalmente = { tratarSessaoLocalmente: true };

export const authService = {
  async login({ email, senha }) {
    const { data } = await api.post(
      '/auth/login',
      { email, senha },
      tratarSessaoLocalmente,
    );
    return data;
  },

  async obterSessao(signal) {
    const { data } = await api.get('/auth/me', {
      ...tratarSessaoLocalmente,
      signal,
    });
    return data;
  },

  async logout() {
    await api.post('/auth/logout', undefined, tratarSessaoLocalmente);
  },
};