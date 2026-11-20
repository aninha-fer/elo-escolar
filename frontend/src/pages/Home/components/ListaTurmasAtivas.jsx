import { Link } from 'react-router-dom';
import { ArrowRight } from 'react-feather';
import { CarregarMais } from '../../../components/CarregarMais';
import { TurmaResumo } from './TurmaResumo';

export function ListaTurmasAtivas({ listagem, ano }) {
    return <section aria-label={`Turmas regulares ativas de ${ano}`} className="flex min-w-0 flex-col xl:absolute xl:inset-0">
        <div data-scroll-listagem className="min-h-0 xl:flex-1 xl:overflow-y-auto">
            <ul className="space-y-sm">{listagem.itens.map((turma) => <TurmaResumo key={turma.id} turma={turma} />)}</ul>
            {!listagem.carregando && !listagem.erro && !listagem.total && <p role="status" className="rounded-lg border border-slate-200 bg-bg-surface p-lg text-sm text-slate-500">Nenhuma turma regular ativa cadastrada para {ano}.</p>}
            <CarregarMais listagem={listagem} testId="inicio-turmas-paginacao" />
        </div>
        <Link data-testid="inicio-ver-turmas" to="/turmas?tipo=REGULAR" className="mt-xs inline-flex w-full items-center justify-end gap-xs rounded-sm text-sm font-semibold text-blue-600 hover:underline">Gerenciar turmas<ArrowRight size={17} aria-hidden="true" /></Link>
    </section>;
}
