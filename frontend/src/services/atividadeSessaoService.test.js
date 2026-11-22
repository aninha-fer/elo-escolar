import test from 'node:test';
import assert from 'node:assert/strict';
import { monitorarAtividadeSessao } from './atividadeSessaoService.js';

function adiada() {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
}

async function microtarefas() { for (let i = 0; i < 24; i++) await Promise.resolve(); }

function preparar(t, opcoes = {}) {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000000 });
    const ouvintes = new Map();
    const documento = { visibilityState: 'visible',
        addEventListener(nome, fn) { ouvintes.set(nome, fn); },
        removeEventListener(nome, fn) { if (ouvintes.get(nome) === fn) ouvintes.delete(nome); } };
    const janela = { ...documento };
    let versao = 1;
    const conexao = { obterVersao: () => versao,
        verificar: t.mock.fn(opcoes.verificar ?? (async () => ({ id: 1 }))) };
    const registrarAtividade = t.mock.fn(opcoes.registrarAtividade ?? (async () => {}));
    const argumentos = { documento, janela, conexao, registrarAtividade };
    const parar = monitorarAtividadeSessao(argumentos);
    t.after(parar);
    return { documento, janela, conexao, registrarAtividade, parar, argumentos,
        invalidar() { versao++; },
        evento(nome, dados = {}) { ouvintes.get(nome)?.({ type: nome, isTrusted: true, ...dados }); },
        async avancar(ms) { t.mock.timers.tick(ms); await microtarefas(); } };
}

test('muitos eventos enviam uma atividade por minuto e descarregam o último sinal pendente', async (t) => {
    const m = preparar(t);
    m.evento('keydown'); await m.avancar(0);
    for (let i = 0; i < 1000; i++) m.evento('pointermove');
    await m.avancar(30000);
    assert.equal(m.registrarAtividade.mock.callCount(), 1);
    m.evento('input'); await m.avancar(29999);
    assert.equal(m.registrarAtividade.mock.callCount(), 1);
    await m.avancar(1);
    assert.equal(m.registrarAtividade.mock.callCount(), 2);
    await m.avancar(60000);
    assert.equal(m.registrarAtividade.mock.callCount(), 2);
});

test('aba abandonada verifica a sessão sem registrar atividade nem usar cache', async (t) => {
    const m = preparar(t);
    for (let i = 0; i < 65; i++) await m.avancar(60000);
    assert.equal(m.registrarAtividade.mock.callCount(), 0);
    assert.equal(m.conexao.verificar.mock.callCount(), 65);
    assert.equal(m.conexao.verificar.mock.calls[0].arguments[0].forcar, true);
});

test('descarta eventos sintéticos, documentos ocultos e rolagem sem entrada humana', async (t) => {
    const m = preparar(t);
    for (const nome of ['input', 'change', 'pointermove', 'keydown']) m.evento(nome, { isTrusted: false });
    m.evento('scroll');
    m.documento.visibilityState = 'hidden'; m.evento('keydown');
    await m.avancar(0);
    assert.equal(m.registrarAtividade.mock.callCount(), 0);
    m.documento.visibilityState = 'visible'; m.evento('wheel'); m.evento('scroll');
    await m.avancar(0);
    assert.equal(m.registrarAtividade.mock.callCount(), 1);
});

test('rolagem por teclado, toque e arraste sinaliza atividade', async (t) => {
    const m = preparar(t);
    for (const [nome, dados] of [['keydown', { key: 'PageDown' }], ['touchmove', {}], ['pointermove', { buttons: 1 }]]) {
        m.evento(nome, dados); m.evento('scroll'); await m.avancar(0); await m.avancar(60000);
    }
    assert.equal(m.registrarAtividade.mock.callCount(), 3);
});

test('retomada consulta o servidor antes de renovar e descarta sinais antigos', async (t) => {
    const consulta = adiada();
    const m = preparar(t, { verificar: () => consulta.promise });
    m.documento.visibilityState = 'hidden';
    await m.avancar(60000);
    m.documento.visibilityState = 'visible'; m.evento('visibilitychange'); m.evento('input');
    await m.avancar(0);
    assert.equal(m.registrarAtividade.mock.callCount(), 0);
    assert.equal(m.conexao.verificar.mock.callCount(), 1);
    consulta.resolve({ id: 1 }); await microtarefas(); await m.avancar(0);
    assert.equal(m.registrarAtividade.mock.callCount(), 1);
});

test('sessão vencida na retomada não recebe renovação', async (t) => {
    const m = preparar(t, { verificar: async () => { throw { response: { status: 401 } }; } });
    m.evento('online'); m.evento('keydown'); await m.avancar(0);
    assert.equal(m.registrarAtividade.mock.callCount(), 0);
});

test('falha de rede mantém só a atividade recente e nunca cria fila de envios', async (t) => {
    let tentativas = 0;
    const m = preparar(t, { registrarAtividade: async () => { if (++tentativas === 1) throw new Error('rede'); } });
    m.evento('input'); await m.avancar(0);
    await m.avancar(1000); m.evento('input');
    await m.avancar(59000); await m.avancar(0);
    assert.equal(m.registrarAtividade.mock.callCount(), 2);
    await m.avancar(60000);
    assert.equal(m.registrarAtividade.mock.callCount(), 2);
});

test('atividade pendente há sessenta segundos é descartada após reconexão', async (t) => {
    const m = preparar(t, { registrarAtividade: async () => { throw new Error('rede'); } });
    m.evento('input'); await m.avancar(0);
    await m.avancar(60000); m.evento('online'); await microtarefas(); await m.avancar(0);
    assert.equal(m.registrarAtividade.mock.callCount(), 1);
});

test('uma chamada em andamento não é duplicada e preserva interações posteriores', async (t) => {
    const envio = adiada();
    const m = preparar(t, { registrarAtividade: () => envio.promise });
    m.evento('pointerdown'); await m.avancar(0);
    await m.avancar(30000); m.evento('input');
    await m.avancar(30000);
    assert.equal(m.registrarAtividade.mock.callCount(), 1);
    envio.resolve(); await microtarefas(); await m.avancar(0);
    assert.equal(m.registrarAtividade.mock.callCount(), 2);
});

test('logout cancela envios, remove listeners e respostas atrasadas não reiniciam o monitor', async (t) => {
    const envio = adiada();
    const m = preparar(t, { registrarAtividade: () => envio.promise });
    m.evento('input'); await m.avancar(0);
    const signal = m.registrarAtividade.mock.calls[0].arguments[0];
    m.invalidar(); m.parar();
    assert.equal(signal.aborted, true);
    envio.resolve(); await microtarefas(); m.evento('input'); await m.avancar(120000);
    assert.equal(m.registrarAtividade.mock.callCount(), 1);
    assert.equal(m.conexao.verificar.mock.callCount(), 0);
});

test('desmontagem e remontagem do StrictMode deixam apenas um monitor', async (t) => {
    const m = preparar(t);
    m.parar();
    const pararNovo = monitorarAtividadeSessao(m.argumentos); t.after(pararNovo);
    m.evento('input'); await m.avancar(0); await m.avancar(60000);
    assert.equal(m.registrarAtividade.mock.callCount(), 1);
    assert.equal(m.conexao.verificar.mock.callCount(), 1);
});

test('aba parada consulta a sessão compartilhada e não encerra a atividade de outra aba', async (t) => {
    const m = preparar(t);
    let ativa = true, ultimaAtividade = Date.now(), consultasAbaParada = 0;
    const usuario = { id: 1 };
    const consultarSessao = async () => ativa && Date.now() - ultimaAtividade < 3600000 ? usuario : null;
    const outraDocumento = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
    const pararOutra = monitorarAtividadeSessao({ documento: outraDocumento, janela: outraDocumento,
        conexao: { obterVersao: () => 1, verificar: async () => { consultasAbaParada++; return consultarSessao(); } },
        registrarAtividade: async () => assert.fail('Aba sem interação não pode renovar.') });
    t.after(pararOutra);
    m.conexao.verificar.mock.mockImplementation(consultarSessao);
    m.registrarAtividade.mock.mockImplementation(async () => { ultimaAtividade = Date.now(); });
    for (let i = 0; i < 65; i++) {
        m.evento('input'); await m.avancar(0); await m.avancar(60000);
    }
    assert.ok(consultasAbaParada >= 65);
    assert.deepEqual(await consultarSessao(), usuario);
    ativa = false;
    assert.equal(await consultarSessao(), null);
});
