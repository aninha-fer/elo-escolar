import { useEffect, useRef, useState } from 'react';
import { Download } from 'react-feather';
import { alunoService } from '../services/alunoService';
import { criarPdfCalendarioAluno, nomeArquivoAluno } from '../utils/exportarCalendarioAluno';
import { criarZipCalendariosAlunos } from '../utils/exportarCalendariosZip';
import { baixarArquivo } from '../utils/baixarArquivo';
import { useToast } from '../contexts/ToastContext';

export function BotaoExportarCalendario({ alunoId, filtros, total, disabled = false, className = '', testId }) {
    const { notificar } = useToast();
    const [exportando, setExportando] = useState(false), [progresso, setProgresso] = useState('');
    const envio = useRef(null);
    useEffect(() => () => envio.current?.abort(), []);

    function cancelar() { envio.current?.abort(); envio.current = null; setExportando(false); setProgresso('Exportação cancelada.'); }

    async function exportar() {
        if (envio.current) return;
        const controller = new AbortController(); envio.current = controller;
        const filtrosIniciais = { ...filtros };
        const { signal } = controller;
        setExportando(true); setProgresso('Preparando exportação...');
        try {
            if (alunoId) {
                const dados = await alunoService.buscarCalendarioExportacao(alunoId, signal);
                if (signal.aborted) return;
                const pdf = await criarPdfCalendarioAluno(dados);
                if (signal.aborted) return;
                baixarArquivo(pdf.output('blob'), nomeArquivoAluno(dados.aluno.nome, dados.aluno.id));
            } else {
                const selecao = await alunoService.selecionarCalendarios(filtrosIniciais, signal);
                if (signal.aborted) return;
                if (!selecao.alunos.length) throw new Error('Nenhum aluno corresponde aos filtros selecionados.');
                const arquivo = await criarZipCalendariosAlunos({ selecao, signal, carregarLote: alunoService.buscarCalendariosLote,
                    onProgresso: (texto) => { if (!signal.aborted) setProgresso(texto); } });
                if (signal.aborted) return;
                const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(selecao.referencia));
                baixarArquivo(arquivo, `calendarios-alunos-${hoje}.zip`);
            }
            setProgresso('');
            notificar('Download preparado.', 'sucesso');
        } catch (error) {
            if (!signal.aborted && error.code !== 'ERR_CANCELED') { notificar(error.response?.data?.erro || error.message || 'Não foi possível exportar os calendários.'); setProgresso(''); }
        } finally {
            if (envio.current === controller) { envio.current = null; if (!signal.aborted) setExportando(false); }
        }
    }
    return <div className={`flex min-w-0 flex-col items-end gap-xs ${className}`}>
        <div className="flex flex-wrap items-center justify-end gap-sm">
            {exportando && <button data-testid={`${testId}-cancelar`} type="button" onClick={cancelar} className="rounded-sm text-sm text-text-muted underline">Cancelar exportação</button>}
            <button data-testid={testId} type="button" onClick={exportar} disabled={disabled || exportando || (!alunoId && !total)} aria-busy={exportando}
                className="inline-flex items-center justify-center gap-sm rounded-sm border border-slate-200 bg-bg-surface px-md py-sm text-sm font-semibold text-text-muted hover:bg-bg-main focus-visible:outline-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:opacity-50">
                <Download size={16} aria-hidden="true" />{exportando ? 'Exportando...' : alunoId ? 'Exportar calendário' : 'Exportar calendários'}
            </button>
        </div>
        {progresso && <p role="status" className="max-w-80 text-right text-xs text-text-muted">{progresso}</p>}
    </div>;
}
