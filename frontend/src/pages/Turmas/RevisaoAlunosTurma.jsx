import { useState } from 'react';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { sortearAlunosTurma } from '../../utils/sorteioTurma';

export function RevisaoAlunosTurma({ alunos, selecionados, bloqueados, capacidade, onSelecionar, onBloquear, onSortear, carregando, erro, onTentarNovamente, disabled }) {
    const [busca, setBusca] = useState('');
    const [aviso, setAviso] = useState('');
    const normalizar = (valor) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
    const filtrados = alunos.filter((aluno) => normalizar(aluno.nome).includes(normalizar(busca)));
    const excedeu = capacidade !== '' && selecionados.length > Number(capacidade);

    function sortear() {
        if (capacidade === '') { setAviso('Defina o número de vagas para essa ação'); return; }
        const ids = sortearAlunosTurma(alunos, bloqueados, Number(capacidade));
        if (!ids) { setAviso('Revise o número de vagas e a quantidade de alunos bloqueados antes de sortear.'); return; }
        setAviso('');
        onSortear(ids);
    }

    return (
        <section aria-label="Alunos da nova turma" className="min-w-0">
            <div className="mb-md flex flex-wrap items-center justify-between gap-sm">
                <div><h3 className="font-bold text-text-main">Alunos da nova turma</h3>
                    <p className="mt-xs text-sm text-text-muted">Selecione ou sorteie alunos do turno escolhido, sem turma regular ativa.</p></div>
                <div className="flex items-center gap-sm">
                    <span data-testid="turma-nova-contador" className="rounded-full bg-blue-50 px-sm py-xs font-mono text-sm text-blue-600">{selecionados.length}{capacidade !== '' ? `/${capacidade}` : ''} alunos</span>
                    <Button data-testid="turma-nova-sortear" type="button" onClick={sortear} disabled={disabled || carregando || Boolean(erro)} className="disabled:cursor-not-allowed disabled:opacity-50">Sortear alunos</Button>
                </div>
            </div>
            <p className="mb-md rounded-sm border border-amber-200 bg-amber-50 p-sm text-sm text-amber-800">Bloqueie os alunos selecionados que devem permanecer. Um novo sorteio preserva os bloqueados e preenche as vagas restantes.</p>
            {aviso && <p role="alert" className="mb-md rounded-sm bg-amber-50 p-sm text-sm text-amber-800">{aviso}</p>}
            {excedeu && <p role="alert" className="mb-md rounded-sm bg-red-50 p-sm text-sm text-red-700">A seleção excede o número de vagas. Remova alunos ou ajuste a capacidade.</p>}
            <Input data-testid="turma-nova-busca-aluno" aria-label="Buscar aluno por nome" placeholder="Buscar aluno por nome..." value={busca} onChange={(event) => setBusca(event.target.value)} disabled={disabled}
                icon={<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>} />
            {carregando ? <p role="status" className="p-md text-sm text-text-muted">Carregando alunos...</p> : erro ? <div className="rounded-sm bg-red-50 p-sm text-sm text-red-700">
                <p role="alert">{erro}</p><button data-testid="turma-nova-alunos-tentar-novamente" type="button" onClick={onTentarNovamente} className="mt-sm underline">Tentar novamente</button>
            </div> : <ul className="max-h-96 divide-y divide-slate-200 overflow-y-auto rounded-sm border border-slate-200">
                {filtrados.length === 0 && <li className="p-md text-sm text-text-muted">{alunos.length ? 'Nenhum aluno encontrado para esta busca.' : 'Nenhum aluno disponível para o turno escolhido.'}</li>}
                {filtrados.map((aluno) => {
                    const selecionado = selecionados.includes(aluno.id);
                    const bloqueado = bloqueados.includes(aluno.id);
                    return <li key={aluno.id} className={`flex items-center gap-sm p-md ${selecionado ? 'bg-blue-50' : 'bg-bg-surface'}`}>
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-sm">
                            <input data-testid={`turma-nova-aluno-${aluno.id}`} type="checkbox" checked={selecionado} disabled={disabled} onChange={() => onSelecionar(aluno.id)} className="size-4 shrink-0 accent-blue-600" />
                            <span className="min-w-0 break-words text-sm font-semibold text-text-main">{aluno.nome}</span>
                            {aluno.participa_procan && <span className="rounded-sm border border-amber-400 bg-amber-50 px-1 text-[10px] font-semibold text-amber-800">PROCAN</span>}
                        </label>
                        {aluno.ano_anterior && <span className="rounded-full bg-bg-surface px-sm py-xs text-xs text-blue-600">Ano anterior</span>}
                        <button data-testid={`turma-nova-bloquear-${aluno.id}`} type="button" disabled={disabled || !selecionado} aria-pressed={bloqueado}
                            aria-label={`${bloqueado ? 'Desbloquear' : 'Bloquear'} ${aluno.nome}`} title={bloqueado ? 'Desbloquear aluno' : 'Preservar aluno no sorteio'} onClick={() => onBloquear(aluno.id)}
                            className={`shrink-0 rounded-sm border p-sm disabled:cursor-not-allowed disabled:opacity-40 ${bloqueado ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-500'}`}>
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="10" width="14" height="11" rx="2" /><path d={bloqueado ? 'M8 10V7a4 4 0 0 1 8 0v3' : 'M8 10V7a4 4 0 0 1 8 0'} /></svg>
                        </button>
                    </li>;
                })}
            </ul>}
        </section>
    );
}
