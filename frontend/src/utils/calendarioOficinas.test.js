import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparOficinasPorDia } from './calendarioOficinas.js';
import { criarPdfCalendarioOficinas } from './exportarCalendarioOficinas.js';

const hora = (valor) => `1970-01-01T${valor}:00.000Z`;
const oficina = (id, nome, dias = [1], inicio = '08:15') => ({ id, nome, turno: 'MANHA', ambiente: { nome: 'Sala Multiuso' },
    horarios: dias.map((dia_semana) => ({ id: id * 10 + dia_semana, dia_semana, hora_inicio: hora(inicio), hora_fim: hora('09:15') })) });

test('grade mantém segunda a sexta e repete oficina em seus dias, com horários e sala', () => {
    const dias = agruparOficinasPorDia([oficina(1, 'Artes Plásticas', [1, 3])]);
    assert.deepEqual(dias.map((d) => d.numero), [1, 2, 3, 4, 5]);
    assert.deepEqual(dias.map((d) => d.oficinas.length), [1, 0, 1, 0, 0]);
    assert.equal(dias[0].oficinas[0].inicio, '08:15');
    assert.equal(dias[0].oficinas[0].fim, '09:15');
    assert.equal(dias[0].oficinas[0].sala, 'Sala Multiuso');
    assert.equal(dias[0].oficinas[0].cor, dias[2].oficinas[0].cor);
    assert.notEqual(dias[0].oficinas[0].chave, dias[2].oficinas[0].chave);
});

test('horários simultâneos permanecem visíveis e ordenação e cores independem da ordem recebida', () => {
    const oficinas = [oficina(1, 'Música', [1], '09:45'), oficina(2, 'Artes', [1]), oficina(3, 'Culinária', [1])];
    const antes = structuredClone(oficinas);
    const dias = agruparOficinasPorDia(oficinas);
    assert.deepEqual(dias[0].oficinas.map((o) => o.nome), ['Artes', 'Culinária', 'Música']);
    assert.deepEqual(dias, agruparOficinasPorDia([...oficinas].reverse()));
    assert.deepEqual(oficinas, antes);
});

test('grade vazia e sala ausente possuem representação explícita', () => {
    assert.ok(agruparOficinasPorDia([]).every((dia) => !dia.oficinas.length));
    const registro = { ...oficina(1, 'Artes'), ambiente: null };
    assert.equal(agruparOficinasPorDia([registro])[0].oficinas[0].sala, 'Sala não informada');
});

test('oficinas da manhã são azuis e da tarde amarelas, independentemente do ID', () => {
    const dias = agruparOficinasPorDia([
        oficina(1, 'Artes', [1, 3]),
        { ...oficina(2, 'Música', [1, 3], '13:30'), turno: 'TARDE' },
    ]);
    for (const indice of [0, 2]) {
        assert.equal(dias[indice].oficinas[0].cor, 0);
        assert.equal(dias[indice].oficinas[1].cor, 1);
    }
});

test('PDF exporta a grade completa com mais de vinte oficinas e quebra de página', async () => {
    const oficinas = Array.from({ length: 60 }, (_, i) => oficina(i + 1, `Oficina ${String(i + 1).padStart(3, '0')}`));
    const dias = agruparOficinasPorDia(oficinas), antes = structuredClone(dias);
    const pdf = await criarPdfCalendarioOficinas(dias, '2026-01-03');
    assert.ok(pdf.getNumberOfPages() > 1);
    const conteudo = pdf.output();
    assert.ok(conteudo.startsWith('%PDF-'));
    for (const oficina of oficinas) assert.ok(conteudo.includes(oficina.nome), oficina.nome);
    assert.ok(conteudo.includes('Sala'));
    assert.ok(conteudo.includes('Multiuso'));
    assert.equal((conteudo.match(/\(Segunda\) Tj/g) ?? []).length, 1);
    assert.ok(!conteudo.includes('cont.'));
    assert.ok(conteudo.includes('03/01/2026'));
    assert.deepEqual(dias, antes);
});

test('PDF preserva acentos e continua textos extensos em outras páginas sem omitir o final', async () => {
    const dias = agruparOficinasPorDia([oficina(1, `Artes Plásticas ${'Descrição '.repeat(300)}FIM_DO_NOME`)]);
    const pdf = await criarPdfCalendarioOficinas(dias, '2026-01-03');
    assert.ok(pdf.getNumberOfPages() > 1);
    assert.ok(pdf.output().includes('Artes Plásticas'));
    assert.ok(pdf.output().includes('FIM_DO_NOME'));
});
