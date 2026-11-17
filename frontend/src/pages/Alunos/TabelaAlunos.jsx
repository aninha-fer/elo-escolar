import { BotaoAcoes } from '../../components/BotaoAcoes';
import { useNavigate } from 'react-router-dom';
import { formatarFrequencia, formatarStatus, formatarTurno } from '../../utils/formatters';
import EditIcon from '../../components/icons/EditIcon';
import { TrashIcon } from '../../components/icons/TrashIcon';

export function TabelaAlunos({ alunos = [], onAcao, onAlterarStatus, onExcluir, alterandoStatus = false }) {
    const navigate = useNavigate();

    const estilosStatus = {
        ATIVO: 'bg-emerald-50 text-emerald-600 before:bg-emerald-600',
        INATIVO: 'bg-slate-100 text-slate-500 before:bg-slate-400',
        RASCUNHO: 'bg-amber-50 text-amber-600 before:bg-amber-500',
    };

    function obterIniciais(nome) {
        return nome
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((parte) => parte[0])
            .join('')
            .toLocaleUpperCase('pt-BR');
    }

    function obterTurma(aluno) {
        const matriculaAtiva = aluno.matriculas_turmas?.find(
            (matricula) => matricula.status === 'ATIVO',
        );

        const nome = aluno.turma?.nome
            ?? aluno.turma_regular?.nome
            ?? matriculaAtiva?.turma?.nome
            ?? aluno.turma_nome
            ?? '—';
        return aluno.turma_regular?.status === 'INATIVO' ? `${nome} — Inativa` : nome;
    }

    return (
        <div className="w-full overflow-x-auto rounded-md border border-slate-200 bg-bg-surface shadow-sm">
            <table className="w-max min-w-full table-auto border-collapse text-left">
                <thead className="bg-bg-main text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                        <th scope="col" className="px-6 py-4">Aluno</th>
                        <th scope="col" className="px-6 py-4">Turma</th>
                        <th scope="col" className="px-6 py-4">Período / Frequência</th>
                        <th scope="col" className="px-6 py-4">Status</th>
                        <th scope="col" className="px-6 py-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {alunos.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                                Nenhum aluno encontrado.
                            </td>
                        </tr>
                    ) : alunos.map((aluno, index) => {
                        const nome = aluno.pessoa?.nome ?? aluno.nome ?? 'Nome não informado';
                        const responsaveis = aluno.responsaveis ?? [];
                        const responsavel = responsaveis[0]?.nome;
                        const dias = Array.isArray(aluno.dias_frequencia)
                            ? formatarFrequencia(aluno.dias_frequencia)
                            : '';
                        const status = aluno.status ?? 'RASCUNHO';

                        return (
                            <tr data-testid={`aluno-${aluno.id}-abrir`}
                                key={aluno.id ?? `${nome}-${index}`}
                                tabIndex={aluno.id == null ? undefined : 0}
                                aria-label={aluno.id == null ? undefined : `Abrir detalhes de ${nome}`}
                                onClick={() => aluno.id != null && navigate(`/alunos/${aluno.id}`)}
                                onKeyDown={(event) => {
                                    if (aluno.id == null || (event.key !== 'Enter' && event.key !== ' ')) return;
                                    event.preventDefault();
                                    navigate(`/alunos/${aluno.id}`);
                                }}
                                className={`cursor-pointer transition-colors hover:bg-bg-main focus-visible:bg-bg-main ${status === 'INATIVO' ? 'text-slate-400' : 'text-slate-800'}`}
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold bg-amber-100 text-tertiary`} aria-hidden="true">
                                            {obterIniciais(nome)}
                                        </span>
                                        <div className="min-w-max">
                                            <div className="flex items-center gap-xs">
                                                <p className="font-semibold">{nome}</p>
                                                {aluno.participa_procan && <span className="rounded-sm border border-amber-400 bg-amber-50 px-1 text-[10px] font-semibold text-amber-800">PROCAN</span>}
                                            </div>
                                            {responsavel && (
                                                <p className="mt-1 text-sm text-slate-500" title={responsaveis.map((item) => item.nome).join(', ')}>
                                                    Resp.: {responsavel}{responsaveis.length > 1 ? ` +${responsaveis.length - 1}` : ''}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-slate-500">{obterTurma(aluno)}</td>
                                <td className="whitespace-nowrap px-6 py-4">
                                    {aluno.turno ? (
                                        <>
                                            <p>{formatarTurno(aluno.turno)}</p>
                                            {dias && <p className="mt-1 text-sm text-slate-500">{dias}</p>}
                                        </>
                                    ) : (
                                        <span className="italic text-slate-400">Não definido</span>
                                    )}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4">
                                    <span className={`inline-flex min-w-30 items-center rounded-full px-4 py-2 text-sm font-semibold before:mr-2 before:size-2 before:shrink-0 before:rounded-full ${estilosStatus[status] ?? estilosStatus.RASCUNHO}`}>
                                        {formatarStatus(status)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {(onAcao || onAlterarStatus || onExcluir) && <div className="inline-flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                                        <BotaoAcoes testId={`aluno-${aluno.id}-acoes`} label={`Ações para ${nome}`} disabled={alterandoStatus} options={[
                                            { id: 'editar', label: 'Editar', disabled: !onAcao, onClick: () => onAcao?.(aluno), icon: <EditIcon /> },
                                            { id: 'status', label: status === 'INATIVO' ? 'Ativar aluno' : 'Inativar aluno',
                                                disabled: !onAlterarStatus, onClick: () => onAlterarStatus?.(aluno) },
                                            { id: 'excluir', label: 'Excluir', textColor: '#DC2626', icon: <TrashIcon />,
                                                disabled: !onExcluir, onClick: () => onExcluir?.(aluno) },
                                        ]} />
                                    </div>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
