import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

test('formulário abre com a equipe selecionada enquanto as opções ainda estão carregando', async (t) => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'elo-turma-vite-'));
    let vite;
    t.after(async () => {
        await vite?.close();
        if (dirname(cacheDir) !== resolve(tmpdir())) throw new Error('Diretório temporário fora do local esperado.');
        await rm(cacheDir, { recursive: true, force: true });
    });
    vite = await createServer({ cacheDir, optimizeDeps: { noDiscovery: true, include: [] },
        server: { middlewareMode: true, hmr: false }, appType: 'custom' });
    const { FormularioTurma } = await vite.ssrLoadModule('/src/pages/Turmas/FormularioTurma.jsx');
    const { ToastContext } = await vite.ssrLoadModule('/src/contexts/ToastContext.jsx');
    const { normalizarProfissionais } = await vite.ssrLoadModule('/src/utils/formatters.jsx');
    const turma = { id: 10, nome: 'Turma teste', tipo: 'REGULAR', turno: 'MANHA', ambiente_id: 1, ano_letivo_id: 2026,
        profissionais: [
            { id: 1, cargo: 'Professor', pessoa: { nome: 'Ana' }, status_geral: 'ATIVO' },
            { id: 2, cargo: 'Auxiliar', pessoa: { nome: 'Bruno' }, status_geral: 'INATIVO' },
        ] };
    const resumida = { ...turma, profissionais: normalizarProfissionais(turma) };
    for (const [descricao, props] of [
        ['edição com dados completos', { turma }],
        ['edição com resumos da listagem', { turma: resumida }],
        ['cópia com dados completos', { turmaOrigem: turma }],
        ['cópia com resumos da listagem', { turmaOrigem: resumida }],
    ]) {
        await t.test(descricao, () => {
            const html = renderToStaticMarkup(createElement(ToastContext.Provider, { value: { notificar() {} } },
                createElement(FormularioTurma, { ...props, onClose() {} })));
            assert.ok(html.includes('2 selecionado(s).'));
            assert.ok(html.includes('Carregando profissionais...'));
        });
    }
});
