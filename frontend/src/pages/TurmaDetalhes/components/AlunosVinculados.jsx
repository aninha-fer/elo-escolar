import { Link } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { formatarFrequencia, obterIniciais } from '../../../utils/formatters';

export function AlunosVinculados({ alunos = [], capacidade, podeVincular, onVincular }) {
    return (
        <section className="min-w-0 overflow-hidden rounded-md border border-slate-200 bg-bg-surface" aria-labelledby="alunos-vinculados-titulo">
            <div className="flex flex-wrap items-center justify-between gap-md border-b border-slate-200 p-lg">
                <h2 id="alunos-vinculados-titulo" className="text-base font-bold text-text-main">
                    Alunos Vinculados <span className="ml-xs text-sm font-normal text-slate-500">
                        ({capacidade == null ? `${alunos.length} alunos · sem limite de vagas` : `${alunos.length} / ${capacidade} vagas`})
                    </span>
                </h2>
                {/* {podeVincular && <Button type="button" onClick={onVincular}>
                    <span aria-hidden="true">＋</span> Vincular Aluno
                </Button>} */}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                    <caption className="sr-only">Alunos com matrícula ativa nesta turma e seus dias de frequência na instituição</caption>
                    <thead className="bg-bg-main font-mono text-xs uppercase tracking-wider text-slate-500">
                        <tr><th scope="col" className="px-lg py-md">Aluno</th><th scope="col" className="px-md py-md">Dias de frequência</th><th scope="col" className="px-lg py-md"><span className="sr-only">Detalhes</span></th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {alunos.length === 0 ? <tr><td colSpan={3} className="px-lg py-10 text-center text-slate-500">Nenhum aluno com matrícula ativa nesta turma.</td></tr>
                            : alunos.map((aluno) => {
                                const nome = aluno.pessoa?.nome || aluno.nome || 'Aluno sem nome';
                                const dias = [...new Set(aluno.dias_frequencia ?? [])].sort((a, b) => a - b);
                                return (
                                    <tr key={aluno.id} className="text-text-main">
                                        <td className="px-lg py-lg">
                                            <div className="flex items-center gap-sm">
                                                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tertiary/20 text-xs font-semibold text-tertiary">{obterIniciais(nome)}</span>
                                                <span className="min-w-24 break-words font-semibold">{nome}</span>
                                            </div>
                                        </td>
                                        <td className="min-w-40 px-md py-lg">
                                            {dias.length > 0 ? <ul aria-label={`Dias de frequência de ${nome}`} className="flex flex-wrap gap-xs">
                                                {dias.map((dia) => <li key={dia} className="rounded-full bg-tertiary/20 px-sm py-xs text-xs font-semibold text-tertiary">{formatarFrequencia([dia])}</li>)}
                                            </ul> : <span className="text-slate-400">Não informado</span>}
                                        </td>
                                        <td className="px-lg py-lg text-right"><Link to={`/alunos/${aluno.id}`} aria-label={`Ver aluno ${nome}`}
                                            className="rounded-sm px-xs py-sm font-semibold text-text-muted hover:text-secondary focus-visible:outline-2 focus-visible:outline-blue-600">Ver</Link></td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
