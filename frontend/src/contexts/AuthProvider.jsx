import { useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import { api } from '../services/api';
import { authService } from '../services/authService';

const sessaoCarregando = { status: 'carregando', usuario: null };
const sessaoAnonima = { status: 'anonimo', usuario: null };

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(sessaoCarregando);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (
          error.response?.status === 401 &&
          !error.config?.tratarSessaoLocalmente
        ) {
          setSessao(sessaoAnonima);
        }

        return Promise.reject(error);
      },
    );

    return () => api.interceptors.response.eject(interceptor);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function verificarSessao() {
      try {
        const usuario = await authService.obterSessao(controller.signal);

        if (!controller.signal.aborted) {
          setSessao({ status: 'autenticado', usuario });
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        const codigo = error.response?.status;

        if (codigo === 401) {
          setSessao(sessaoAnonima);
        } else if (codigo === 403) {
          setSessao({ status: 'acesso-negado', usuario: null });
        } else {
          setSessao({ status: 'erro', usuario: null });
        }
      }
    }

    verificarSessao();

    return () => controller.abort();
  }, [tentativa]);

  function recarregarSessao() {
    setSessao(sessaoCarregando);
    setTentativa((atual) => atual + 1);
  }

  async function entrar(credenciais) {
    const usuario = await authService.login(credenciais);
    setSessao({ status: 'autenticado', usuario });
  }

  async function sair() {
    try {
      await authService.logout();
    } catch (error) {
      if (error.response?.status !== 401) throw error;
    }

    setSessao(sessaoAnonima);
  }

  return (
    <AuthContext.Provider
      value={{ ...sessao, entrar, sair, recarregarSessao }}
    >
      {children}
    </AuthContext.Provider>
  );
}