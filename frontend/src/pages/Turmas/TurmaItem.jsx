import { formatarFrequencia, formatarStatus, formatarTurno } from '../../utils/formatters';
import { agruparHorarios } from '../../utils/formatters';

const estilosStatus = {
    ATIVO: 'bg-emerald-50 text-emerald-600',
    INATIVO: 'bg-slate-100 text-slate-500',
    PROVISORIO: 'bg-amber-50 text-amber-700',
};
const rotulosStatus = { ATIVO: 'Ativa', INATIVO: 'Inativa', PROVISORIO: 'Provisória' };

function formatarDias(dias) {
    const consecutivos = dias.length > 2 && dias.every((dia, indice) => indice === 0 || dia === dias[indice - 1] + 1);
    return consecutivos
        ? formatarFrequencia([dias[0], dias.at(-1)]).replace(', ', '–')
        : formatarFrequencia(dias).replaceAll(', ', '/');
}

function obterIniciais(nome) {
    return nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toLocaleUpperCase('pt-BR');
}

export function TurmaItem({ turma, profissionais = [], onSelecionar, podeEditar = false }) {
    const grupos = agruparHorarios(turma.horarios);
    const nome = turma.nome || 'Turma sem nome';
    const horarios = grupos.map((grupo) => `${formatarDias(grupo.dias)} ${grupo.inicio}–${grupo.fim}`).join(' · ');
    const ocupacao = turma.vagas_ocupadas ?? 0;
    const capacidade = turma.capacidade_maxima == null ? `${ocupacao} alunos · sem limite de vagas` : `${ocupacao}/${turma.capacidade_maxima} alunos`;

    return (
        <li className="relative rounded-md border border-slate-200 bg-bg-surface shadow-sm transition-colors hover:border-slate-300">
            <article className="min-w-0 p-lg pr-16">
                <div className="flex flex-wrap items-center gap-sm">
                    <h2 className="min-w-0 break-words text-base font-bold text-text-main">{nome}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${estilosStatus[turma.status] ?? 'bg-slate-100 text-slate-500'}`}>
                        {rotulosStatus[turma.status] ?? formatarStatus(turma.status)}
                    </span>
                </div>
                <div className="mt-xs flex flex-wrap items-center gap-x-md gap-y-xs font-mono text-xs text-slate-500">
                    <span className="flex min-w-0 items-start gap-xs">
                        <span className="min-w-0 break-words">🕐{turma.tipo === 'OFICINA' ? `${formatarTurno(turma.turno)}: ` : ''}{horarios || 'Horários não informados'}</span>
                    </span>
                    <span className="inline-flex items-center gap-xs">
                        📍{turma.ambiente?.nome || 'Ambiente não informado'}
                    </span>
                    <span className="inline-flex items-center gap-xs">
                        <svg className="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M19 14a5 5 0 0 1 2 4v3" /></svg>
                        {capacidade}
                    </span>
                </div>
                {turma.descricao && <p className="mt-sm break-words text-sm text-slate-500">{turma.descricao}</p>}
                {profissionais.length > 0 ? (
                    <ul aria-label="Profissionais responsáveis" className="mt-sm flex flex-wrap gap-sm">
                        {profissionais.map((profissional, indice) => (
                            <li key={profissional.id ?? `${profissional.nome}-${indice}`} className={`inline-flex max-w-full items-center gap-xs rounded-full px-sm py-xs text-xs font-semibold bg-tertiary/20 text-tertiary`}>
                                <span className="min-w-0 break-words">{profissional.nome}</span>
                            </li>
                        ))}
                    </ul>
                ) : <p className="mt-sm text-xs text-slate-500">Profissional não informado</p>}
                <button type="button" className="absolute inset-0 size-full cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
                    aria-label={`Selecionar ${turma.tipo === 'OFICINA' ? 'oficina' : 'turma'} ${nome}`} onClick={() => onSelecionar?.(turma)} />
                {podeEditar && <button type="button" disabled aria-label={`Ações indisponíveis para ${nome}`} title="Ações ainda indisponíveis"
                    className="absolute right-md top-md z-10 inline-flex size-8 cursor-not-allowed items-center justify-center rounded-sm border-2 border-slate-200 text-slate-400">
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><circle cx="3" cy="9" r="1.5" /><circle cx="9" cy="9" r="1.5" /><circle cx="15" cy="9" r="1.5" /></svg>
                </button>}
            </article>
        </li>
    );
}
