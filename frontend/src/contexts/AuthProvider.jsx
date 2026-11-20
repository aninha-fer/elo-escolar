import { useEffect, useRef, useState } from 'react';
import { AuthContext } from './AuthContext';
import { api } from '../services/api';
import { authService } from '../services/authService';

const sessaoCarregando = { status: 'carregando', usuario: null };
const sessaoAnonima = { status: 'anonimo', usuario: null };

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(sessaoCarregando);
  const [tentativa, setTentativa] = useState(0);
  const versaoSessao = useRef(0);

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 403 && error.response?.data?.codigo === 'TROCA_SENHA_OBRIGATORIA') {
          setTentativa((atual) => atual + 1);
        }
        if (
          error.response?.status === 401 &&
          !error.config?.tratarSessaoLocalmente
        ) {
          versaoSessao.current++;
          setSessao(sessaoAnonima);
        }

        return Promise.reject(error);
      },
    );

    return () => api.interceptors.response.eject(interceptor);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const versao = versaoSessao.current;

    async function verificarSessao() {
      try {
        const usuario = await authService.obterSessao(controller.signal);

        if (!controller.signal.aborted && versao === versaoSessao.current) {
          setSessao({ status: 'autenticado', usuario });
        }
      } catch (error) {
        if (controller.signal.aborted || versao !== versaoSessao.current) return;

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
    versaoSessao.current++;
    setSessao({ status: 'autenticado', usuario });
  }

  async function sair() {
    try {
      await authService.logout();
    } catch (error) {
      if (error.response?.status !== 401) throw error;
    }

    versaoSessao.current++;
    setSessao(sessaoAnonima);
  }

  async function trocarSenhaInicial(dados) {
    try {
      const usuario = await authService.trocarSenhaInicial(dados);
      versaoSessao.current++;
      setSessao({ status: 'autenticado', usuario });
    } catch (error) {
      if (error.response?.status === 401) {
        versaoSessao.current++;
        setSessao({ ...sessaoAnonima, avisoSessao: error.response?.data?.erro || 'Sessão inválida ou expirada.' });
      }
      throw error;
    }
  }

  return (
    <AuthContext.Provider
      value={{ ...sessao, entrar, sair, recarregarSessao, trocarSenhaInicial }}
    >
      {children}
    </AuthContext.Provider>
  );
}
