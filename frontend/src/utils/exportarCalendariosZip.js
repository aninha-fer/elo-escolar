import { criarPdfCalendarioAluno, nomeArquivoAluno } from './exportarCalendarioAluno.js';

function conferirCancelamento(signal) {
    if (signal?.aborted) throw Object.assign(new Error('Exportação cancelada.'), { code: 'ERR_CANCELED' });
}

export async function criarZipCalendariosAlunos({ selecao, carregarLote, signal, onProgresso = () => {} }) {
    const { default: JSZip } = await import('jszip');
    conferirCancelamento(signal);
    const zip = new JSZip(), usados = new Set();
    let concluidos = 0;
    for (let inicio = 0; inicio < selecao.alunos.length; inicio += 20) {
        conferirCancelamento(signal);
        const ids = selecao.alunos.slice(inicio, inicio + 20).map((a) => a.id);
        const calendarios = await carregarLote(ids, selecao.referencia, signal);
        if (calendarios.length !== ids.length || calendarios.some((c, i) => c.aluno.id !== ids[i])) throw new Error('A seleção de alunos mudou. Atualize a listagem e tente novamente.');
        for (const calendario of calendarios) {
            conferirCancelamento(signal);
            const pdf = await criarPdfCalendarioAluno(calendario);
            zip.file(nomeArquivoAluno(calendario.aluno.nome, calendario.aluno.id, usados), pdf.output('arraybuffer'));
            onProgresso(`Gerando calendários: ${++concluidos}/${selecao.alunos.length}`);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }
    conferirCancelamento(signal);
    const arquivo = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 3 } }, ({ percent }) => {
        conferirCancelamento(signal); onProgresso(`Preparando ZIP: ${Math.round(percent)}%`);
    });
    conferirCancelamento(signal);
    return arquivo;
}
