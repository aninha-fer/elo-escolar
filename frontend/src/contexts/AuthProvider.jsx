import { useEffect, useRef, useState } from 'react';
import { AuthContext } from './AuthContext';
import { api, conexao } from '../services/api';
import { authService } from '../services/authService';
import { TelaConexao } from '../components/Conexao/TelaConexao';

const sessaoCarregando = { status: 'carregando', usuario: null };
const sessaoAnonima = { status: 'anonimo', usuario: null };

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(sessaoCarregando);
  const [tentativa, setTentativa] = useState(0);
  const [estadoConexao, setEstadoConexao] = useState(conexao.obterEstado);
  const focoAnterior = useRef(null);
  const sobreposicaoVisivel = useRef(false);
  const autenticacaoAtual = useRef(null);
  const montado = useRef(false);

  useEffect(() => {
    montado.current = true;
    function atualizar() {
      const estado = conexao.obterEstado();
      if (estado.visivel && !sobreposicaoVisivel.current) focoAnterior.current = document.activeElement;
      sobreposicaoVisivel.current = estado.visivel;
      setEstadoConexao(estado);
    }
    const remover = conexao.assinar(atualizar);
    atualizar();
    const removerSessao = conexao.assinarSessao((usuario, versao) => {
      if (versao !== conexao.obterVersao()) return;
      setSessao((anterior) => usuario ? { status: 'autenticado', usuario } : {
        ...sessaoAnonima,
        avisoSessao: anterior.usuario ? 'Sua sessão expirou. Entre novamente.' : anterior.avisoSessao,
      });
    });
    return () => {
      remover(); removerSessao(); montado.current = false;
      queueMicrotask(() => {
        if (!montado.current) { autenticacaoAtual.current?.abort(); conexao.invalidar(); }
      });
    };
  }, []);

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.code === 'ERR_CANCELED' || error.respostaApiValida === false
          || (error.config?._versaoSessao !== undefined && error.config._versaoSessao !== conexao.obterVersao())) return Promise.reject(error);
        if (error.response?.status === 403 && error.response?.data?.codigo === 'TROCA_SENHA_OBRIGATORIA') {
          setTentativa((atual) => atual + 1);
        }
        if (
          error.response?.status === 401 &&
          !error.config?.tratarSessaoLocalmente
        ) {
          conexao.registrarSessao(null, conexao.invalidar());
        }

        return Promise.reject(error);
      },
    );

    return () => api.interceptors.response.eject(interceptor);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const versao = conexao.obterVersao();

    async function verificarSessao() {
      try {
        const usuario = await authService.obterSessao(controller.signal);

        if (!controller.signal.aborted && versao === conexao.obterVersao()) {
          setSessao(usuario ? { status: 'autenticado', usuario } : sessaoAnonima);
        }
      } catch (error) {
        if (controller.signal.aborted || error.code === 'ERR_CANCELED' || versao !== conexao.obterVersao()) return;

        const codigo = error.response?.status;

        if (codigo === 401) {
          setSessao(sessaoAnonima);
        } else if (codigo === 403) {
          setSessao({ status: 'acesso-negado', usuario: null });
        }
      }
    }

    verificarSessao();

    return () => controller.abort();
  }, [tentativa]);

  function recarregarSessao() {
    setTentativa((atual) => atual + 1);
  }

  function iniciarAutenticacao() {
    autenticacaoAtual.current?.abort();
    autenticacaoAtual.current = new AbortController();
    return { versao: conexao.invalidar(), signal: autenticacaoAtual.current.signal };
  }

  async function entrar(credenciais) {
    const { versao, signal } = iniciarAutenticacao();
    const usuario = await authService.login(credenciais, signal);
    if (versao === conexao.obterVersao()) conexao.registrarSessao(usuario, versao);
  }

  async function sair() {
    const { versao, signal } = iniciarAutenticacao();
    try {
      await authService.logout(signal);
    } catch (error) {
      if (error.response?.status !== 401 || error.respostaApiValida !== true) throw error;
    }

    if (versao === conexao.obterVersao()) {
      conexao.registrarSessao(null, versao);
      setSessao(sessaoAnonima);
    }
  }

  async function trocarSenhaInicial(dados) {
    const { versao, signal } = iniciarAutenticacao();
    try {
      const usuario = await authService.trocarSenhaInicial(dados, signal);
      if (versao === conexao.obterVersao()) conexao.registrarSessao(usuario, versao);
    } catch (error) {
      if (versao === conexao.obterVersao() && error.response?.status === 401 && error.respostaApiValida !== false) {
        conexao.registrarSessao(null, conexao.invalidar());
        setSessao({ ...sessaoAnonima, avisoSessao: error.response?.data?.erro || 'Sessão inválida ou expirada.' });
      }
      throw error;
    }
  }

  return (
    <AuthContext.Provider
      value={{ ...sessao, entrar, sair, recarregarSessao, trocarSenhaInicial }}
    >
      <div inert={estadoConexao.visivel} aria-hidden={estadoConexao.visivel ? true : undefined}>{children}</div>
      {estadoConexao.visivel && <TelaConexao estado={estadoConexao} inicial={sessao.status === 'carregando'}
        focoAnterior={focoAnterior} onTentarNovamente={() => { void conexao.verificar().catch(() => {}); }} />}
    </AuthContext.Provider>
  );
}
