import { hojeInstituicao } from './anoLetivo.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function diasDiario(calendario, mes) {
    if (!calendario || !Number.isInteger(mes) || mes < 1 || mes > 12) return [];
    const dia = new Date(0); dia.setUTCFullYear(calendario.ano, mes - 1, 1);
    const inicio = calendario.data_inicio.slice(0, 10), fim = calendario.data_fim.slice(0, 10), dias = [];
    while (dia.getUTCMonth() === mes - 1) {
        const iso = dia.toISOString().slice(0, 10);
        if (iso >= inicio && iso <= fim && dia.getUTCDay() !== 0 && dia.getUTCDay() !== 6) dias.push(new Date(dia));
        dia.setUTCDate(dia.getUTCDate() + 1);
    }
    return dias;
}

export function mesesDiario(calendario, hoje = hojeInstituicao()) {
    if (!calendario) return [];
    return MESES.flatMap((label, i) => {
        const mes = i + 1;
        const atualOuFuturo = calendario.ano > Number(hoje.slice(0, 4))
            || (calendario.ano === Number(hoje.slice(0, 4)) && mes >= Number(hoje.slice(5, 7)));
        return atualOuFuturo && diasDiario(calendario, mes).length ? [{ value: String(mes), label }] : [];
    });
}

export async function criarArquivoDiario(dados, mes) {
    const dias = diasDiario(dados.calendario, mes);
    if (!dias.length) throw new Error('O mês selecionado não possui dias úteis dentro do calendário letivo.');
    const { default: ExcelJS } = await import('exceljs');
    const planilha = new ExcelJS.Workbook();
    const folha = planilha.addWorksheet('Diário de classe', {
        properties: { defaultRowHeight: 15 },
        pageSetup: { paperSize: 9, orientation: 'portrait', margins: { left: 0.51, right: 0.51, top: 0.79, bottom: 0.79, header: 0.31, footer: 0.31 } },
    });
    folha.getColumn(1).width = 42;
    for (let coluna = 2; coluna <= dias.length + 1; coluna++) folha.getColumn(coluna).width = 11.3;
    folha.mergeCells(1, 2, 1, dias.length + 1);
    folha.getCell(1, 2).value = 'Datas';
    folha.getCell(1, 2).alignment = { horizontal: 'center' };
    folha.getCell(2, 1).value = 'Nomes:';
    dias.forEach((dia, i) => {
        folha.getCell(2, i + 2).value = `${DIAS[dia.getUTCDay()]} - ${String(dia.getUTCDate()).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
    });
    for (let linha = 1; linha <= 2; linha++) {
        for (let coluna = 1; coluna <= dias.length + 1; coluna++) {
            const celula = folha.getCell(linha, coluna);
            celula.font = { name: 'Aptos Narrow', size: 11, italic: true };
            celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
        }
    }
    const alunos = [...dados.alunos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    alunos.forEach((aluno, i) => {
        const linha = folha.getRow(i + 3), frequencia = new Set(aluno.dias_frequencia);
        linha.height = Math.max(15, Math.ceil(aluno.nome.length / 42) * 15);
        linha.getCell(1).value = aluno.nome;
        linha.getCell(1).font = { name: 'Aptos Narrow', size: 11 };
        linha.getCell(1).alignment = { wrapText: true, vertical: 'middle' };
        dias.forEach((dia, j) => {
            if (!frequencia.has(dia.getUTCDay())) linha.getCell(j + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
        });
    });
    const conteudo = await planilha.xlsx.writeBuffer();
    const base = Array.from(dados.nome.normalize('NFC')).filter(c => c.codePointAt(0) >= 32 && !'<>:"/\\|?*'.includes(c)).slice(0, 40).join('').trim();
    return { arquivo: new Blob([conteudo], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        nome: `diario-${base || 'turma'}-${dados.calendario.ano}-${String(mes).padStart(2, '0')}.xlsx` };
}
