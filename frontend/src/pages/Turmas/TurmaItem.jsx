import { agruparHorarios, formatarFrequencia, formatarStatus, formatarTurno } from '../../utils/formatters';
import { BotaoAcoes } from '../../components/BotaoAcoes';
import { CampoInformacao } from '../../components/CampoInformacao';
import EditIcon from '../../components/icons/EditIcon';
import { TrashIcon } from '../../components/icons/TrashIcon';
import { TagExpiradaTurma } from '../../components/TagExpiradaTurma';

const estilosStatus = {
    ATIVO: 'bg-emerald-50 text-emerald-600',
    INATIVO: 'bg-slate-100 text-slate-500',
    PROVISORIO: 'bg-amber-50 text-amber-700',
};
const rotulosStatus = { ATIVO: 'Ativa', INATIVO: 'Inativa', PROVISORIO: 'Provisória' };

function CampoTurma({ titulo, valor, descricao = false, className }) {
    return <CampoInformacao titulo={titulo} valor={valor}
        className={`min-w-0 space-y-sm ${descricao ? 'sm:col-span-2 md:col-span-3 xl:col-span-1' : ''} ${className}`}
        tituloClassName="break-words font-mono text-xs uppercase tracking-widest text-slate-500"
        valorClassName={`whitespace-pre-wrap break-words text-sm leading-relaxed text-text-main ${descricao ? '' : 'font-semibold'}`} />;
}

function ProfessoresTurma({ profissionais }) {
    if (!profissionais.length) return 'Profissional não informado';
    return <ul aria-label="Profissionais responsáveis" className="flex flex-wrap gap-sm">
        {profissionais.map((profissional, indice) => <li key={profissional.id ?? `${profissional.nome}-${indice}`}
            className="inline-flex max-w-full items-center rounded-full bg-amber-50 px-sm py-xs text-xs font-semibold text-amber-600">
            <span className="min-w-0 break-words">{profissional.nome}</span>
        </li>)}
    </ul>;
}

export function TurmaItem({ turma, profissionais = [], onSelecionar, podeEditar = false, onEditar, onAlterarStatus, onExcluir, onCriarAPartir }) {
    const oficina = turma.tipo === 'OFICINA';
    const grupos = agruparHorarios(turma.horarios);
    const dias = [...new Set(grupos.flatMap((grupo) => grupo.dias))];
    const nome = turma.nome || 'Turma sem nome';
    const horarios = grupos.map((grupo) => `${formatarTurno(turma.turno)}: ${grupo.inicio} – ${grupo.fim}`).join('\n');
    const ocupacao = turma.vagas_ocupadas ?? 0;
    const capacidade = turma.capacidade_maxima == null ? `${ocupacao} Alunos · Sem limite de vagas` : `${ocupacao}/${turma.capacidade_maxima} Alunos`;

    return (
        <li className="relative rounded-lg border border-slate-200 bg-bg-surface shadow-sm transition-colors hover:border-slate-300">
            <article className="min-w-0">
                <header className="flex min-h-15 items-center gap-md border-b border-slate-200 px-lg py-sm">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-sm">
                        <h2 className="min-w-0 break-words text-md font-bold text-text-main">{nome}</h2>
                        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${estilosStatus[turma.status] ?? 'bg-slate-100 text-slate-500'}`}>
                            {rotulosStatus[turma.status] ?? formatarStatus(turma.status)}
                        </span>
                        {turma.tipo === 'REGULAR' && turma.ano_letivo?.ano && <span
                            className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-600"
                            aria-label={`Ano letivo ${turma.ano_letivo.ano}`}>
                            {turma.ano_letivo.ano}
                        </span>}
                        <TagExpiradaTurma expirada={turma.expirada} testId={`turma-${turma.id}-expirada`} />
                    </div>
                    {podeEditar && <div className="relative z-10 shrink-0"><BotaoAcoes testId={`turma-${turma.id}-acoes`} label={`Ações para ${nome}`} options={[
                        { id: 'editar', label: 'Editar', disabled: !onEditar, onClick: () => onEditar(turma), icon: <EditIcon /> },
                        { id: 'status', label: turma.status === 'INATIVO' ? 'Ativar turma' : 'Inativar turma', disabled: !onAlterarStatus || (turma.status === 'INATIVO' && turma.expirada), onClick: () => onAlterarStatus(turma) },
                        ...(turma.tipo === 'REGULAR' && turma.status === 'INATIVO' ? [{ id: 'criar-a-partir', label: 'Criar nova turma a partir desta', disabled: !onCriarAPartir, onClick: () => onCriarAPartir(turma) }] : []),
                        { id: 'excluir', label: 'Excluir', textColor: '#DC2626', disabled: !onExcluir, onClick: () => onExcluir(turma), icon: <TrashIcon /> },
                    ]} /></div>}
                </header>
                <dl className="flex flex-row justify-between p-md">
                    {oficina ? <>
                        <CampoTurma titulo="Dias" valor={dias.length ? formatarFrequencia(dias) : 'Dias não informados'} />
                        <CampoTurma titulo="Horário" valor={horarios || 'Horários não informados'} />
                    </> : <CampoTurma titulo="Período" valor={formatarTurno(turma.turno)} />}
                    <CampoTurma titulo="Sala" valor={turma.ambiente?.nome || 'Ambiente não informado'} />
                    <CampoTurma titulo="Vagas" valor={capacidade} />
                    <CampoTurma titulo="Professores" valor={<ProfessoresTurma profissionais={profissionais} />} />
                    <CampoTurma titulo="Descrição" valor={turma.descricao || '-'} descricao className="w-70"/>
                </dl>
                <button data-testid={`turma-${turma.id}-abrir`} type="button" className="absolute inset-0 size-full cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
                    aria-label={`Selecionar ${oficina ? 'oficina' : 'turma'} ${nome}`} onClick={() => onSelecionar?.(turma)} />
            </article>
        </li>
    );
}
