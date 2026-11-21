import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { diasDiario, mesesDiario, criarArquivoDiario } from './exportarDiarioTurma.js';

const calendario = { ano: 2027, data_inicio: '2027-02-15T00:00:00Z', data_fim: '2027-12-18T00:00:00Z' };
const iso = dia => dia.toISOString().slice(0, 10);

test('dias respeitam início e término letivos e omitem somente sábados e domingos', () => {
    const fevereiro = diasDiario(calendario, 2), dezembro = diasDiario(calendario, 12);
    assert.equal(iso(fevereiro[0]), '2027-02-15');
    assert.equal(iso(fevereiro.at(-1)), '2027-02-26');
    assert.equal(fevereiro.length, 10);
    assert.equal(iso(dezembro.at(-1)), '2027-12-17');
    assert.equal(diasDiario(calendario, 1).length, 0);
    assert.equal(diasDiario(calendario, 13).length, 0);
});

test('mês inteiro inclui a quinta semana e não exclui feriados', () => {
    const dias = diasDiario({ ano: 2026, data_inicio: '2026-01-01', data_fim: '2026-12-31' }, 11);
    assert.equal(dias.length, 21);
    assert.equal(iso(dias[0]), '2026-11-02');
    assert.equal(iso(dias.at(-1)), '2026-11-30');
});

test('ano bissexto inclui 29/02 quando for dia de semana', () => {
    const dias = diasDiario({ ano: 2028, data_inicio: '2028-02-01', data_fim: '2028-02-29' }, 2);
    assert.equal(iso(dias.at(-1)), '2028-02-29');
});

test('opções do modal mostram somente meses atuais ou futuros que contenham dias letivos', () => {
    assert.deepEqual(mesesDiario(calendario, '2027-11-21').map(m => m.value), ['11', '12']);
    assert.equal(mesesDiario(calendario, '2026-11-21')[0].value, '2');
    assert.deepEqual(mesesDiario(calendario, '2028-01-01'), []);
    assert.deepEqual(mesesDiario(null), []);
    assert.deepEqual(mesesDiario({ ano: 2027, data_inicio: '2027-02-20', data_fim: '2027-02-21' }, '2026-11-21'), []);
});

test('XLSX mantém cabeçalho mesclado, ordena todos os alunos e colore apenas dias fora da frequência', async () => {
    const dados = { nome: 'Turma Girassol', calendario, alunos: Array.from({ length: 27 }, (_, i) => ({ nome: `Aluno ${String(27 - i).padStart(2, '0')}`, dias_frequencia: i === 26 ? [1, 2, 4, 5] : [1, 2, 3, 4, 5] })) };
    const antes = structuredClone(dados);
    const { arquivo, nome } = await criarArquivoDiario(dados, 2);
    assert.equal(nome, 'diario-Turma Girassol-2027-02.xlsx');
    const livro = new ExcelJS.Workbook(); await livro.xlsx.load(await arquivo.arrayBuffer());
    const folha = livro.worksheets[0];
    assert.equal(folha.getCell('A2').value, 'Nomes:');
    assert.equal(folha.getCell('B1').value, 'Datas');
    assert.equal(folha.getCell('K1').master.address, 'B1');
    assert.equal(folha.getCell('B2').value, 'Seg - 15/02');
    assert.equal(folha.getCell('K2').value, 'Sex - 26/02');
    assert.equal(folha.getCell('A3').value, 'Aluno 01');
    assert.equal(folha.getCell('A29').value, 'Aluno 27');
    assert.equal(folha.getCell('D3').fill.fgColor.argb, 'FFFF0000');
    assert.equal(folha.getCell('I3').fill.fgColor.argb, 'FFFF0000');
    assert.equal(folha.getCell('B3').fill?.fgColor, undefined);
    assert.equal(folha.getCell('D4').fill?.fgColor, undefined);
    assert.equal(folha.getCell('D3').value, null);
    assert.equal(folha.getCell('B2').fill.fgColor.argb, 'FFE8E8E8');
    assert.deepEqual(dados, antes);
});

test('nomes são textos literais, arquivos possuem nome seguro e mês vazio é recusado', async () => {
    const dados = { nome: 'Turma / A:*?', calendario, alunos: [{ nome: '=Nome de teste', dias_frequencia: [1] }] };
    const { arquivo, nome } = await criarArquivoDiario(dados, 2);
    assert.ok(!/[<>:"/\\|?*]/.test(nome));
    const livro = new ExcelJS.Workbook(); await livro.xlsx.load(await arquivo.arrayBuffer());
    assert.equal(livro.worksheets[0].getCell('A3').value, '=Nome de teste');
    await assert.rejects(criarArquivoDiario(dados, 1), /não possui dias úteis/);
});
