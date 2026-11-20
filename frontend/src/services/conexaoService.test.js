import test from 'node:test';
import assert from 'node:assert/strict';
import { criarConexao, falhaTemporaria } from './conexaoService.js';
import { validarIdentidadeSessao } from '../utils/validarIdentidadeSessao.js';

const usuario = { id: 1, nome: 'Teste', email: 'teste@example.com', role: 'professor', deve_trocar_senha: false };
function adiada() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
async function microtarefas() { for (let i = 0; i < 16; i++) await Promise.resolve(); }
function relogio(t) {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
    return async (ms) => { t.mock.timers.tick(ms); await microtarefas(); };
}

test('identidade rejeita HTML e objetos incompletos sem aceitar autenticação falsa', () => {
    for (const valor of ['<html>Carregando</html>', {}, { ...usuario, role: 'outro' }, { ...usuario, deve_trocar_senha: undefined }]) {
        assert.throws(() => validarIdentidadeSessao(valor), { code: 'RESPOSTA_INVALIDA' });
    }
    assert.deepEqual(validarIdentidadeSessao({ ...usuario, senha_versao: 2 }), usuario);
});

test('requisições concorrentes compartilham verificação e cancelamento individual não afeta as outras', async () => {
    const consulta = adiada(); let chamadas = 0;
    const conexao = criarConexao({ consultarSessao: () => { chamadas++; return consulta.promise; } });
    const controller = new AbortController();
    const cancelada = conexao.verificar({ signal: controller.signal });
    const outras = [conexao.verificar(), conexao.verificar()];
    controller.abort();
    await assert.rejects(cancelada, { code: 'ERR_CANCELED' });
    consulta.resolve(usuario);
    assert.deepEqual(await Promise.all(outras), [usuario, usuario]);
    assert.equal(chamadas, 1);
});

test('StrictMode pode abortar e remontar imediatamente sem duplicar a consulta', async (t) => {
    const avancar = relogio(t), consulta = adiada(); let chamadas = 0;
    const conexao = criarConexao({ consultarSessao: () => { chamadas++; return consulta.promise; } });
    const controller = new AbortController();
    const primeira = conexao.verificar({ signal: controller.signal });
    controller.abort();
    const segunda = conexao.verificar();
    await assert.rejects(primeira, { code: 'ERR_CANCELED' });
    await avancar(0); consulta.resolve(usuario);
    assert.deepEqual(await segunda, usuario);
    assert.equal(chamadas, 1);
});

test('sem consumidores cancela a consulta e limpa a sobreposição', async (t) => {
    const avancar = relogio(t); let signal;
    const conexao = criarConexao({ consultarSessao: (config) => new Promise((resolve, reject) => {
        signal = config.signal; signal.addEventListener('abort', () => reject(Object.assign(new Error(), { code: 'ERR_CANCELED' })), { once: true });
    }) });
    const controller = new AbortController();
    const consulta = conexao.verificar({ signal: controller.signal });
    controller.abort(); await assert.rejects(consulta, { code: 'ERR_CANCELED' }); await avancar(0);
    assert.equal(signal.aborted, true);
    assert.equal(conexao.obterEstado().fase, 'ociosa');
});

test('sessão ausente confirma comunicação, permite login e impede operação protegida', async () => {
    let chamadas = 0;
    const conexao = criarConexao({ consultarSessao: async () => { chamadas++; return null; } });
    assert.equal(await conexao.verificar(), null);
    await assert.rejects(conexao.verificar({ forcar: false, exigirSessao: true }), (erro) => erro.response.status === 401 && erro.enviado === false);
    assert.equal(chamadas, 1);
});

test('marcador de comunicação evita nova consulta antes de sessenta segundos, sem polling', async (t) => {
    const avancar = relogio(t); let chamadas = 0;
    const conexao = criarConexao({ consultarSessao: async () => { chamadas++; return usuario; } });
    await conexao.verificar(); await avancar(50000);
    conexao.registrarComunicacao(conexao.obterVersao());
    await avancar(20000); await conexao.verificar({ forcar: false });
    assert.equal(chamadas, 1);
    await avancar(40000); await conexao.verificar({ forcar: false });
    assert.equal(chamadas, 2);
    await avancar(300000); assert.equal(chamadas, 2);
});

test('apresentação completa aparece após dois segundos e não exige tempo mínimo', async (t) => {
    const avancar = relogio(t), consulta = adiada();
    const conexao = criarConexao({ consultarSessao: () => consulta.promise });
    const espera = conexao.verificar();
    await avancar(1999); assert.equal(conexao.obterEstado().visivel, false);
    await avancar(1); assert.equal(conexao.obterEstado().visivel, true);
    consulta.resolve(usuario); await espera;
    assert.equal(conexao.obterEstado().visivel, false);
    await avancar(90000); assert.equal(conexao.obterEstado().visivel, false);
});

test('falha temporária espera três segundos e recupera sem alterar a autenticação para erro', async (t) => {
    const avancar = relogio(t); let chamadas = 0;
    const conexao = criarConexao({ consultarSessao: async () => { if (++chamadas === 1) throw new Error('rede'); return usuario; } });
    const espera = conexao.verificar(); await microtarefas();
    await avancar(2999); assert.equal(chamadas, 1);
    await avancar(1); assert.deepEqual(await espera, usuario);
    assert.equal(chamadas, 2);
});

test('prazo total inclui chamadas e intervalos, reduz a última tentativa e termina em noventa segundos', async (t) => {
    const avancar = relogio(t), timeouts = [];
    const conexao = criarConexao({ consultarSessao: ({ signal, timeout }) => new Promise((resolve, reject) => {
        timeouts.push(timeout);
        const timer = setTimeout(() => { signal.removeEventListener('abort', cancelar); reject(new Error('rede')); }, Math.min(5000, timeout));
        function cancelar() { clearTimeout(timer); reject(Object.assign(new Error(), { code: 'ERR_CANCELED' })); }
        signal.addEventListener('abort', cancelar, { once: true });
    }) });
    const espera = conexao.verificar().catch((erro) => erro);
    for (let segundo = 0; segundo < 90; segundo++) await avancar(1000);
    assert.equal((await espera).code, 'CONEXAO_INDISPONIVEL');
    assert.equal(Date.now(), 90000);
    assert.equal(timeouts.at(-1), 2000);
    assert.equal(conexao.obterEstado().fase, 'falha');
    const total = timeouts.length; await avancar(90000); assert.equal(timeouts.length, total);
});

test('invalidação impede resposta antiga de restaurar a identidade e libera nova verificação', async () => {
    const antiga = adiada(); let chamadas = 0; const eventos = [];
    const conexao = criarConexao({ consultarSessao: () => ++chamadas === 1 ? antiga.promise : Promise.resolve({ ...usuario, id: 2 }) });
    conexao.assinarSessao((u) => eventos.push(u));
    const anterior = conexao.verificar(); conexao.invalidar();
    const atual = await conexao.verificar(); antiga.resolve(usuario);
    await assert.rejects(anterior, { code: 'ERR_CANCELED' });
    assert.equal(atual.id, 2); assert.deepEqual(eventos.map((u) => u.id), [2]);
    assert.equal(conexao.registrarSessao(usuario, 0), false);
});

for (const status of [403, 429]) {
    test(`verificação não repete resposta definitiva ${status}`, async () => {
        let chamadas = 0;
        const conexao = criarConexao({ consultarSessao: async () => { chamadas++; throw { response: { status, data: { erro: 'Acesso indisponível.' } } }; } });
        await assert.rejects(conexao.verificar(), (erro) => erro.response.status === status);
        assert.equal(chamadas, 1);
    });
}

test('classificação não recupera validações, permissões, conflitos ou cancelamentos', () => {
    for (const status of [400, 401, 403, 404, 409, 422, 429, 500]) assert.equal(falhaTemporaria({ response: { status } }), false);
    for (const status of [502, 503, 504]) assert.equal(falhaTemporaria({ response: { status } }), true);
    assert.equal(falhaTemporaria({ code: 'ERR_CANCELED' }), false);
    assert.equal(falhaTemporaria({ code: 'RESPOSTA_INVALIDA', response: { status: 200 } }), true);
});
