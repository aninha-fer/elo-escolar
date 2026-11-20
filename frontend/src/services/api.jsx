import axios from 'axios';
import { criarConexao, erroCancelamento, falhaTemporaria } from './conexaoService';
import { validarIdentidadeSessao } from '../utils/validarIdentidadeSessao';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

function respostaJson(response) {
  return /application\/(?:[\w.-]+\+)?json/i.test(response.headers?.['content-type'] ?? '')
    && response.data !== null && typeof response.data === 'object';
}

function respostaInvalida(response) {
  return Object.assign(new Error('O servidor retornou uma resposta inesperada.'), {
    code: 'RESPOSTA_INVALIDA', respostaApiValida: false, config: response.config,
    response: { ...response, data: { erro: 'O servidor retornou uma resposta inesperada.' } },
  });
}

export const conexao = criarConexao({
  async consultarSessao({ signal, timeout, versao }) {
    try {
      const { data } = await api.get('/auth/me', {
        signal, timeout, ignorarConexao: true, tratarSessaoLocalmente: true, _versaoSessao: versao,
      });
      return validarIdentidadeSessao(data);
    } catch (erro) {
      if (erro.response?.status === 401 && erro.respostaApiValida === true && typeof erro.response.data?.erro === 'string') return null;
      throw erro;
    }
  },
});

api.interceptors.request.use(async (config) => {
  config._versaoSessao ??= conexao.obterVersao();
  if (!config.ignorarConexao) {
    try {
      await conexao.verificar({ signal: config.signal, forcar: false, exigirSessao: !config.sessaoPublica });
    } catch (erro) {
      throw Object.assign(new Error(erro.message), erro, { config, enviado: false });
    }
  }
  if (config._versaoSessao !== conexao.obterVersao() || config.signal?.aborted) throw erroCancelamento();
  return config;
});

async function tratarFalha(erro) {
  const config = erro.config;
  if (!config || erro.code === 'ERR_CANCELED') throw erro;
  if (config._versaoSessao !== conexao.obterVersao()) throw erroCancelamento();
  if (!config.ignorarConexao && erro.enviado !== false && falhaTemporaria(erro)) {
    const leitura = ['get', 'head'].includes(config.method);
    if (leitura && !config._recuperada) {
      await conexao.verificar({ signal: config.signal, exigirSessao: !config.sessaoPublica });
      return api({ ...config, _recuperada: true });
    }
    if (!leitura) {
      // O envio pode ter sido processado. A recuperação consulta a sessão, nunca repete a gravação.
      void conexao.verificar().catch(() => {});
      erro.code = 'RESULTADO_NAO_CONFIRMADO';
      const mensagensAuth = {
        '/auth/login': 'Não foi possível confirmar seu acesso. Tente entrar novamente.',
        '/auth/logout': 'Não foi possível confirmar a saída do sistema. Tente novamente.',
        '/auth/primeiro-acesso/senha': 'Não foi possível confirmar a alteração da senha. Se ela tiver sido alterada, entre novamente com a nova senha.',
      };
      erro.response = { ...erro.response, data: { erro: mensagensAuth[config.url]
        || 'Não foi possível confirmar o resultado. Confira os dados antes de tentar novamente.' } };
    }
  }
  throw erro;
}

api.interceptors.response.use(async (response) => {
  if (response.config._versaoSessao !== conexao.obterVersao()) throw erroCancelamento();
  const binario = ['blob', 'arraybuffer'].includes(response.config.responseType);
  const identidade = /\/auth\/(login|me|primeiro-acesso\/senha)$/.test(response.config.url);
  if (identidade || (response.status !== 204 && response.config.method !== 'head' && !binario)) {
    if (!respostaJson(response)) return tratarFalha(respostaInvalida(response));
    if (identidade) {
      try { response.data = validarIdentidadeSessao(response.data); }
      catch { return tratarFalha(respostaInvalida(response)); }
    }
  }
  conexao.registrarComunicacao(response.config._versaoSessao);
  return response;
}, (erro) => {
  if (erro.enviado === false || erro.code === 'ERR_CANCELED') return tratarFalha(erro);
  if (erro.response) {
    if (!respostaJson(erro.response)) return tratarFalha(respostaInvalida(erro.response));
    erro.respostaApiValida = true;
    if ([400, 401, 403, 404, 409, 422, 429].includes(erro.response.status)) conexao.registrarComunicacao(erro.config?._versaoSessao);
  }
  return tratarFalha(erro);
});
