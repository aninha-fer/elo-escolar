import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { criarPdfCalendarioAluno, nomeArquivoAluno } from './exportarCalendarioAluno.js';
import { criarZipCalendariosAlunos } from './exportarCalendariosZip.js';

function calendario(id = 1, nome = 'Aluno teste') {
    return { aluno: { id, nome, status: 'ATIVO', turno: 'MANHA' }, data_referencia: '2026-11-20', ano: 2026,
        oficinas: [{ id: 1, nome: 'Artes', turno: 'MANHA', profissional: 'Professor das artes', provisorio: false,
            horarios: [1, 3].map((dia_semana) => ({ dia_semana, inicio: '08:15', fim: '09:15' })) }],
        turmas_regulares: [{ id: 2, nome: 'Girassol', profissional: 'Professor regular', sala: 'Sala 01', provisorio: false,
            horarios: [1, 2, 3, 4, 5].map((dia_semana) => ({ dia_semana, inicio: '07:30', fim: '11:30' })) }],
        atendimentos: [{ id: 3, modalidade: 'Psicologia', profissional: 'Clínico teste', dias_semana: [2], hora_inicio: '10:00',
            duracao_minutos: 40, tipo_recorrencia: 'SEMANAL', frequencia: 2, proxima_data: '2026-11-24', provisorio: false }] };
}

test('PDF individual compacto é A4 retrato, preserva os dados e inclui todas as atividades', async () => {
    const dados = calendario(), antes = structuredClone(dados);
    const pdf = await criarPdfCalendarioAluno(dados);
    assert.equal(pdf.getNumberOfPages(), 1);
    assert.ok(Math.abs(pdf.internal.pageSize.getHeight() - 297) < 0.1);
    assert.ok(Math.abs(pdf.internal.pageSize.getWidth() - 210) < 0.1);
    const conteudo = pdf.output();
    for (const texto of ['Aluno teste', 'Artes', '08:15', 'Professor das artes', 'Girassol', 'Sala 01', 'Professor regular', 'Psicologia', 'Clínico teste', '40 minutos', '20/11/2026']) assert.ok(conteudo.includes(texto), texto);
    assert.deepEqual(dados, antes);
});

test('PDF multipágina não perde oficinas nem nomes longos e identifica provisórios', async () => {
    const dados = calendario(); dados.aluno.status = 'RASCUNHO';
    dados.oficinas = Array.from({ length: 35 }, (_, i) => ({ ...dados.oficinas[0], nome: `Oficina-${i}-teste`, provisorio: true }));
    dados.oficinas[0].profissional = 'Nome profissional extenso '.repeat(50);
    const pdf = await criarPdfCalendarioAluno(dados), conteudo = pdf.output();
    assert.ok(pdf.getNumberOfPages() > 1);
    for (let i = 1; i < 35; i++) assert.ok(conteudo.includes(`Oficina-${i}-teste`), `Oficina ${i}`);
    assert.ok(conteudo.includes('Provis'));
    assert.ok(conteudo.includes('Girassol'));
    assert.ok(conteudo.includes('Psicologia'));
});

test('PDF preserva todos os profissionais de turmas e oficinas, inclusive em equipes extensas', async () => {
    const dados = calendario();
    const nomes = Array.from({ length: 80 }, (_, i) => `Docente${i}`);
    dados.oficinas[0].profissional = nomes.join(', ');
    dados.turmas_regulares[0].profissional = 'AuxiliarEquipe, ProfessorEquipe';
    const pdf = await criarPdfCalendarioAluno(dados), conteudo = pdf.output();
    for (const nome of [...nomes, 'AuxiliarEquipe', 'ProfessorEquipe']) assert.ok(conteudo.includes(nome), nome);
});

test('nomes de arquivo são seguros, compactos e únicos mesmo com homônimos', () => {
    const usados = new Set();
    assert.equal(nomeArquivoAluno('Ana', 1, usados), 'Ana.pdf');
    assert.equal(nomeArquivoAluno('ana', 2, usados), 'ana-2.pdf');
    assert.equal(nomeArquivoAluno('ana', 2, usados), 'ana-2-2.pdf');
    assert.equal(nomeArquivoAluno('../A:B?*', 3), '..AB.pdf');
    assert.equal(nomeArquivoAluno('CON', 4), 'Aluno CON.pdf');
    assert.equal(nomeArquivoAluno('  ...', 5), 'Aluno.pdf');
    assert.ok(new TextEncoder().encode(nomeArquivoAluno('Á'.repeat(200), 6)).length < 200);
});

test('ZIP inclui todos os filtrados além da primeira página, em lotes de 20 e sem sobrescrever homônimos', async () => {
    const alunos = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, nome: i < 2 ? 'Mesmo Nome' : `Aluno ${i + 1}` }));
    const referencia = '2026-11-20T15:00:00Z', chamadas = [], progresso = [];
    const blob = await criarZipCalendariosAlunos({ selecao: { alunos, referencia }, onProgresso: (p) => progresso.push(p),
        carregarLote: async (ids, instante) => { chamadas.push(ids); assert.equal(instante, referencia); return ids.map((id) => calendario(id, alunos[id - 1].nome)); } });
    assert.deepEqual(chamadas.map((c) => c.length), [20, 3]);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    assert.equal(Object.keys(zip.files).length, 23);
    assert.ok(zip.file('Mesmo Nome.pdf'));
    assert.ok(zip.file('Mesmo Nome-2.pdf'));
    assert.ok((await zip.file('Aluno 23.pdf').async('string')).startsWith('%PDF'));
    assert.ok(progresso.includes('Gerando calendários: 23/23'));
});

test('cancelamento interrompe exportação entre PDFs sem entregar ZIP parcial', async () => {
    const controller = new AbortController(), alunos = [{ id: 1 }, { id: 2 }];
    await assert.rejects(criarZipCalendariosAlunos({ selecao: { alunos, referencia: '2026-11-20T15:00:00Z' }, signal: controller.signal,
        carregarLote: async () => [calendario(1), calendario(2)], onProgresso: () => controller.abort() }), { code: 'ERR_CANCELED' });
});

test('lote ausente ou fora de ordem impede arquivo parcial', async () => {
    const selecao = { alunos: [{ id: 1 }, { id: 2 }], referencia: '2026-11-20T15:00:00Z' };
    for (const lote of [[calendario(1)], [calendario(2), calendario(1)]]) {
        await assert.rejects(criarZipCalendariosAlunos({ selecao, carregarLote: async () => lote }), /seleção de alunos mudou/);
    }
});
