export function erroCancelamento() {
    return Object.assign(new Error('Operação cancelada.'), { code: 'ERR_CANCELED' });
}

export function erroSessao() {
    return Object.assign(new Error('Sua sessão expirou. Entre novamente.'), {
        enviado: false, respostaApiValida: true,
        response: { status: 401, data: { erro: 'Sua sessão expirou. Entre novamente.' } },
    });
}

export function falhaTemporaria(erro) {
    if (erro.code === 'ERR_CANCELED') return false;
    return !erro.response || [502, 503, 504].includes(erro.response.status)
        || (erro.code === 'RESPOSTA_INVALIDA' && erro.response.status >= 200 && erro.response.status < 300);
}

function erroIndisponivel(causa) {
    return Object.assign(new Error('Não foi possível estabelecer conexão. Tente novamente.'), {
        code: 'CONEXAO_INDISPONIVEL', cause: causa, enviado: false,
        response: { data: { erro: 'Não foi possível estabelecer conexão. Tente novamente.' } },
    });
}

// Uma única verificação atende as chamadas em espera, sem armazenar ou repetir gravações.
export function criarConexao({ consultarSessao, agora = () => Date.now(), temporizador = setTimeout, limparTemporizador = clearTimeout,
    prazo = 90000, intervalo = 3000, atrasoVisual = 2000, validade = 60000, timeout = 10000 }) {
    let versao = 0, ultimaComunicacao = -Infinity, usuario;
    let verificacao = null;
    let estado = { fase: 'ociosa', visivel: false, erro: '' };
    const ouvintes = new Set(), ouvintesSessao = new Set();

    function publicar(proximo) {
        estado = proximo;
        ouvintes.forEach((ouvinte) => ouvinte());
    }

    function registrarSessao(proximo, origem = versao) {
        if (origem !== versao) return false;
        usuario = proximo;
        ultimaComunicacao = agora();
        ouvintesSessao.forEach((ouvinte) => ouvinte(proximo, origem));
        return true;
    }

    function esperar(ms, signal) {
        return new Promise((resolve, reject) => {
            const timer = temporizador(() => { signal.removeEventListener('abort', cancelar); resolve(); }, ms);
            function cancelar() { limparTemporizador(timer); signal.removeEventListener('abort', cancelar); reject(erroCancelamento()); }
            signal.addEventListener('abort', cancelar, { once: true });
            if (signal.aborted) cancelar();
        });
    }

    function iniciar() {
        const atual = { controller: new AbortController(), versao, consumidores: new Set(), abandono: null };
        verificacao = atual;
        publicar({ fase: 'verificando', visivel: false, erro: '' });
        const inicio = agora();
        let expirou = false;
        const visual = temporizador(() => {
            if (verificacao === atual) publicar({ fase: 'verificando', visivel: true, erro: '' });
        }, atrasoVisual);
        const limite = temporizador(() => { expirou = true; atual.controller.abort(); }, prazo);
        atual.promise = (async () => {
            try {
                while (true) {
                    if (atual.controller.signal.aborted) throw erroCancelamento();
                    try {
                        const restante = prazo - (agora() - inicio);
                        if (restante <= 0) { expirou = true; throw erroCancelamento(); }
                        const identidade = await consultarSessao({ signal: atual.controller.signal, timeout: Math.min(timeout, restante), versao: atual.versao });
                        if (atual.controller.signal.aborted || atual.versao !== versao) throw erroCancelamento();
                        registrarSessao(identidade, atual.versao);
                        publicar({ fase: 'ociosa', visivel: false, erro: '' });
                        return identidade;
                    } catch (erro) {
                        if (atual.controller.signal.aborted || !falhaTemporaria(erro)) throw erro;
                        const restante = prazo - (agora() - inicio);
                        if (restante <= 0) { expirou = true; throw erro; }
                        await esperar(Math.min(intervalo, restante), atual.controller.signal);
                    }
                }
            } catch (erro) {
                if (atual.versao !== versao || (atual.controller.signal.aborted && !expirou)) throw erroCancelamento();
                const falha = erroIndisponivel(erro);
                // Respostas definitivas de autorização mantêm seu significado para as guardas.
                const definitivo = [401, 403, 429].includes(erro.response?.status) && erro.respostaApiValida !== false;
                publicar({ fase: 'falha', visivel: true, statusHttp: definitivo ? erro.response.status : undefined,
                    erro: definitivo ? (erro.response.data?.erro || falha.message) : falha.message });
                throw definitivo ? erro : falha;
            } finally {
                limparTemporizador(visual); limparTemporizador(limite); limparTemporizador(atual.abandono);
                if (verificacao === atual) {
                    verificacao = null;
                    if (estado.fase === 'verificando') publicar({ fase: 'ociosa', visivel: false, erro: '' });
                }
            }
        })();
        return atual;
    }

    function aguardar(atual, signal) {
        if (signal?.aborted) return Promise.reject(erroCancelamento());
        limparTemporizador(atual.abandono);
        return new Promise((resolve, reject) => {
            const consumidor = {};
            atual.consumidores.add(consumidor);
            function remover() {
                signal?.removeEventListener('abort', cancelar);
                atual.consumidores.delete(consumidor);
                if (!atual.consumidores.size && verificacao === atual) {
                    // Permite que a remontagem imediata do StrictMode reutilize a verificação.
                    atual.abandono = temporizador(() => { if (!atual.consumidores.size) atual.controller.abort(); }, 0);
                }
            }
            function cancelar() { remover(); reject(erroCancelamento()); }
            signal?.addEventListener('abort', cancelar, { once: true });
            atual.promise.then((resultado) => { remover(); resolve(resultado); }, (erro) => { remover(); reject(erro); });
        });
    }

    async function verificar({ signal, forcar = true, exigirSessao = false } = {}) {
        if (signal?.aborted) throw erroCancelamento();
        const origem = versao;
        const identidade = !forcar && !verificacao && usuario !== undefined && agora() - ultimaComunicacao < validade
            ? usuario : await aguardar(verificacao ?? iniciar(), signal);
        if (origem !== versao || signal?.aborted) throw erroCancelamento();
        if (exigirSessao && !identidade) throw erroSessao();
        return identidade;
    }

    return {
        verificar,
        registrarSessao,
        registrarComunicacao(origem) { if (origem === versao) ultimaComunicacao = agora(); },
        obterVersao: () => versao,
        obterEstado: () => estado,
        assinar(ouvinte) { ouvintes.add(ouvinte); return () => ouvintes.delete(ouvinte); },
        assinarSessao(ouvinte) { ouvintesSessao.add(ouvinte); return () => ouvintesSessao.delete(ouvinte); },
        invalidar() {
            versao++; usuario = undefined; ultimaComunicacao = -Infinity;
            verificacao?.controller.abort(); verificacao = null;
            publicar({ fase: 'ociosa', visivel: false, erro: '' });
            return versao;
        },
    };
}
