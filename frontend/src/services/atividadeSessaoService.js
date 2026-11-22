const INTERVALO_MS = 60000;
const TECLAS_ROLAGEM = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

export function monitorarAtividadeSessao({ documento, janela, conexao, registrarAtividade,
    agora = () => Date.now(), temporizador = setTimeout, limparTemporizador = clearTimeout }) {
    const controller = new AbortController(), versao = conexao.obterVersao();
    let encerrado = false, pendente = null, sequencia = 0, ultimoEnvio = -Infinity;
    let envio = false, verificacao = null, precisaVerificar = false;
    let ultimaVerificacao = agora(), entradaRolagem = -Infinity;
    let timerAtividade, timerVerificacao;
    const opcoes = { capture: true, passive: true };

    function atual() { return !encerrado && versao === conexao.obterVersao(); }
    function visivel() { return documento.visibilityState === 'visible'; }
    function descartarAntiga() {
        if (pendente && agora() - pendente.em >= INTERVALO_MS) pendente = null;
    }

    async function verificar() {
        if (!atual()) return null;
        if (!verificacao) {
            verificacao = conexao.verificar({ signal: controller.signal, forcar: true, exigirSessao: true })
                .then((usuario) => {
                    if (atual()) { precisaVerificar = false; ultimaVerificacao = agora(); }
                    return usuario;
                }).catch(() => { if (atual()) precisaVerificar = true; return null; })
                .finally(() => { verificacao = null; });
        }
        return verificacao;
    }

    function agendarAtividade() {
        if (!atual() || !pendente || envio || !visivel() || timerAtividade !== undefined) return;
        timerAtividade = temporizador(() => { timerAtividade = undefined; void enviar(); },
            Math.max(0, INTERVALO_MS - (agora() - ultimoEnvio)));
    }

    async function enviar() {
        if (!atual() || envio || !visivel()) return;
        descartarAntiga();
        if (!pendente) return;
        envio = true;
        try {
            if (precisaVerificar || agora() - ultimaVerificacao >= INTERVALO_MS) {
                if (!await verificar()) return;
            }
            descartarAntiga();
            if (!atual() || !visivel() || !pendente) return;
            const enviada = pendente.sequencia;
            ultimoEnvio = agora();
            await registrarAtividade(controller.signal);
            if (atual() && pendente?.sequencia === enviada) pendente = null;
        } catch (erro) {
            if (atual() && erro.code !== 'ERR_CANCELED') precisaVerificar = true;
        } finally {
            envio = false;
            // Falhas de conexão aguardam a próxima verificação, sem um ciclo de tentativas imediato.
            if (atual() && !precisaVerificar) agendarAtividade();
        }
    }

    function interacao(evento) {
        if (!atual() || !visivel() || !evento.isTrusted) return;
        const instante = agora();
        if (evento.type === 'scroll' && instante - entradaRolagem > 1500) return;
        if (['wheel', 'touchmove', 'pointerdown'].includes(evento.type)
            || (evento.type === 'keydown' && TECLAS_ROLAGEM.has(evento.key))
            || (evento.type === 'pointermove' && evento.buttons)) entradaRolagem = instante;
        pendente = { em: instante, sequencia: ++sequencia };
        agendarAtividade();
    }

    async function retomar() {
        if (!atual() || !visivel()) return;
        precisaVerificar = true;
        if (await verificar()) agendarAtividade();
    }

    async function conferirPeriodicamente() {
        if (!atual()) return;
        try {
            if (await verificar()) { descartarAntiga(); agendarAtividade(); }
        } finally {
            if (atual()) timerVerificacao = temporizador(conferirPeriodicamente, INTERVALO_MS);
        }
    }

    const eventos = ['pointerdown', 'pointermove', 'keydown', 'input', 'change', 'scroll', 'wheel', 'touchmove'];
    eventos.forEach((evento) => documento.addEventListener(evento, interacao, opcoes));
    documento.addEventListener('visibilitychange', retomar);
    janela.addEventListener('online', retomar);
    janela.addEventListener('pageshow', retomar);
    timerVerificacao = temporizador(conferirPeriodicamente, INTERVALO_MS);

    function parar() {
        encerrado = true;
        controller.abort();
        limparTemporizador(timerAtividade); limparTemporizador(timerVerificacao);
        pendente = null;
        eventos.forEach((evento) => documento.removeEventListener(evento, interacao, opcoes));
        documento.removeEventListener('visibilitychange', retomar);
        janela.removeEventListener('online', retomar);
        janela.removeEventListener('pageshow', retomar);
    }

    return parar;
}
