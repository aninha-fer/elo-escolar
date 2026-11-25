import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

test('feedbacks de carregamento ficam no controle acionado e preservam o conteúdo', async (t) => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'elo-spinner-vite-'));
    let vite;
    t.after(async () => {
        await vite?.close();
        if (dirname(cacheDir) !== resolve(tmpdir())) throw new Error('Diretório temporário fora do local esperado.');
        await rm(cacheDir, { recursive: true, force: true });
    });
    vite = await createServer({ cacheDir, optimizeDeps: { noDiscovery: true, include: [] },
        server: { middlewareMode: true, hmr: false }, appType: 'custom' });
    const carregar = (nome) => vite.ssrLoadModule(`/src/${nome}.jsx`);
    const { Button } = await carregar('components/Button');
    const { Modal } = await carregar('components/Modal');
    const { CalendarioSemanal } = await carregar('components/CalendarioSemanal');
    const { CarregarMais } = await carregar('components/CarregarMais');
    const { TabelaAlunos } = await carregar('pages/Alunos/TabelaAlunos');
    const { AtendimentoItem } = await carregar('components/AtendimentoItem');
    const { Spinner } = await carregar('components/Spinner');
    const renderizar = (componente, props) => renderToStaticMarkup(createElement(componente, props));
    const botao = (html, id) => html.match(new RegExp(`<button(?=[^>]*data-testid="${id}")[\\s\\S]*?</button>`))?.[0];

    await t.test('botão bloqueia novos envios e mantém o texto original como reserva de espaço', () => {
        const html = renderizar(Button, { loading: true, loadingLabel: 'Salvando aluno...', children: 'Salvar aluno' });
        assert.match(html, /<button[^>]*disabled=""[^>]*aria-busy="true"/);
        assert.match(html, /aria-hidden="true"[^>]*class="[^"]*invisible/);
        assert.match(html, /role="status" aria-label="Salvando aluno/);
        assert.match(html, /Salvar aluno/);
        assert.doesNotMatch(renderizar(Button, { children: 'Salvar aluno' }), /role="status"/);
    });

    await t.test('salvar rascunho mostra spinner somente no botão secundário', () => {
        const html = renderizar(Modal, { isOpen: true, testId: 'modal', title: 'Aluno', confirmText: 'Salvar e ativar',
            secondaryText: 'Salvar rascunho', onSecondaryAction() {}, onConfirm() {}, isSecondaryLoading: true });
        const secundario = botao(html, 'modal-acao-secundaria'), principal = botao(html, 'modal-confirmar');
        assert.match(secundario, /role="status"/);
        assert.match(secundario, /aria-busy="true"/);
        assert.doesNotMatch(principal, /role="status"/);
        assert.match(principal, /disabled=""/);
    });

    await t.test('apenas a linha do aluno em edição mostra spinner e os menus permanecem visíveis', () => {
        const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(TabelaAlunos, {
            alunos: [{ id: 1, nome: 'Ana', status: 'ATIVO' }, { id: 2, nome: 'Bruno', status: 'ATIVO' }],
            podeEditar: true, alterandoStatus: true, carregandoEdicaoId: 2, onAcao() {},
        })));
        assert.doesNotMatch(botao(html, 'aluno-1-acoes'), /role="status"/);
        assert.match(botao(html, 'aluno-2-acoes'), /role="status"/);
        assert.equal((html.match(/role="status"/g) ?? []).length, 1);
    });

    await t.test('editar atendimento mostra o indicador dentro do menu acionado', () => {
        const html = renderizar(AtendimentoItem, { atendimento: { id: 2, modalidade: 'Fisioterapia', tipo_recorrencia: 'SEMANAL' },
            onEditar() {}, cancelando: true, carregandoEdicao: true });
        assert.match(botao(html, 'atendimento-2-acoes'), /aria-label="Carregando atendimento para edição/);
    });

    await t.test('calendário mantém a mesma grade e seus eventos enquanto carrega outra semana', () => {
        const agenda = { semana_inicio: '2026-11-23', eventos: [{ id: 'a', titulo: 'Oficina', tipo: 'OFICINA', dia_semana: 1,
            hora_inicio: '08:15', hora_fim: '09:15', profissional: 'Professor' }] };
        const normal = renderizar(CalendarioSemanal, { agenda });
        const ocupado = renderizar(CalendarioSemanal, { agenda, carregando: true });
        assert.equal((ocupado.match(/h-12 border-b/g) ?? []).length, (normal.match(/h-12 border-b/g) ?? []).length);
        assert.match(ocupado, /Oficina/);
        assert.match(ocupado, /absolute inset-0 z-20 flex items-center justify-center/);
        assert.match(ocupado, /role="status" aria-label="Carregando agenda/);
        assert.match(ocupado, /aria-busy="true"/);
        assert.doesNotMatch(normal, /class="spinner/);
    });

    await t.test('paginação manual mantém spinner dentro do botão; automática usa o final da lista', () => {
        const base = { carregandoMais: true, temMais: true, carregarMais() {}, recarregar() {} };
        const manual = renderizar(CarregarMais, { testId: 'pagina', listagem: { ...base, carregamentoManual: true } });
        const automatica = renderizar(CarregarMais, { testId: 'pagina', listagem: base });
        assert.match(botao(manual, 'pagina-carregar'), /role="status"/);
        assert.equal((manual.match(/role="status"/g) ?? []).length, 1);
        assert.doesNotMatch(automatica, /<button/);
        assert.match(automatica, /role="status"/);
    });

    await t.test('tela global de conexão mantém sua apresentação e oculta os indicadores locais', async () => {
        const { AuthProvider } = await carregar('contexts/AuthProvider');
        const { conexao } = await carregar('services/api');
        const original = conexao.obterEstado;
        conexao.obterEstado = () => ({ fase: 'verificando', visivel: true, erro: '' });
        try {
            const html = renderToStaticMarkup(createElement(AuthProvider, null, createElement(Spinner, { label: 'Salvando aluno...' })));
            assert.match(html, /<div[^>]*inert=""[^>]*aria-hidden="true"[^>]*data-conexao-bloqueada="true"/);
            assert.match(html, /data-testid="conexao-sobreposicao"/);
            assert.match(html, /Validando seu acesso/);
        } finally { conexao.obterEstado = original; }
    });
});
