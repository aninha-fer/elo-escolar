import { Link } from 'react-router-dom';
import { BookOpen } from 'react-feather';
import { formatarTurno } from '../../../utils/formatters';

export function TurmaResumo({ turma }) {
    const vagas = turma.capacidade_maxima == null ? `${turma.vagas_ocupadas ?? 0} alunos · Sem limite de vagas` : `${turma.vagas_ocupadas ?? 0}/${turma.capacidade_maxima} alunos`;
    return <li>
        <Link data-testid={`inicio-turma-${turma.id}`} to={`/turmas/${turma.id}`}
            className="flex min-w-0 items-center gap-md overflow-hidden rounded-lg border border-slate-200 border-l-[5px] border-l-tertiary bg-bg-surface p-lg shadow-sm transition-colors hover:bg-amber-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700"><BookOpen size={21} aria-hidden="true" /></span>
            <div className="min-w-0"><h3 className="break-words text-base font-bold leading-snug text-text-main">{turma.nome}</h3>
                <p className="mt-sm break-words text-xs leading-relaxed text-slate-500">{formatarTurno(turma.turno)} · {turma.ambiente?.nome || 'Sala não informada'} · {vagas}</p>
            </div>
        </Link>
    </li>;
}
