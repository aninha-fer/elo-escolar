import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { CarregarMais } from '../../components/CarregarMais';
import EditIcon from '../../components/icons/EditIcon';
import { useListagemInfinita } from '../../hooks/useListagemInfinita';
import { anosLetivosService } from '../../services/anosLetivosService';
import { hojeInstituicao, periodoLetivo } from '../../utils/anoLetivo';
import { FormularioAnoLetivo } from './FormularioAnoLetivo';

export function Configuracoes() {
    const [editando, setEditando] = useState(null);
    const listagem = useListagemInfinita(anosLetivosService.listarPagina);
    const hoje = hojeInstituicao();

    return <div className="flex flex-col gap-lg w-[50%]">
        <header>
            <p className="mb-sm font-mono text-xs uppercase tracking-widest text-secondary">Administração</p>
            <h1 className="text-2xl font-bold text-text-main">Configurações</h1>
        </header>
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-bg-surface shadow-sm">
            <header className="border-t-4 border-t-tertiary border-b border-b-slate-200 p-lg">
                <h2 className="text-lg font-bold text-text-main">Cadastrar ano letivo</h2>
                <p className="mt-xs text-sm text-text-muted">Registre as datas oficiais de início e encerramento.</p>
            </header>
            <div className="p-lg"><FormularioAnoLetivo onSalvo={listagem.recarregar} /></div>
        </section>
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-bg-surface shadow-sm">
            <header className="border-b border-slate-200 p-lg border-t-4 border-t-tertiary">
                <h2 className="text-lg font-bold text-text-main">Calendários cadastrados</h2>
                <p className="mt-xs text-sm text-text-muted">Histórico dos períodos letivos da instituição.</p>
            </header>
            <ul className="divide-y divide-slate-200">{listagem.itens.map((calendario) => {
                const encerrado = calendario.data_fim.slice(0, 10) < hoje;
                const futuro = calendario.data_inicio.slice(0, 10) > hoje;
                return <li key={calendario.id} className="flex flex-wrap items-center gap-md p-lg">
                    <span className={`rounded-md p-md text-sm font-bold ${!encerrado && !futuro ? 'bg-emerald-50 text-success' : 'bg-blue-50 text-secondary'}`}>{calendario.ano}</span>
                    <span className="text-sm font-semibold text-text-main">{periodoLetivo(calendario)}</span>
                    <span className={`rounded-full px-sm py-xs text-xs ${encerrado ? 'bg-slate-100 text-text-muted' : futuro ? 'bg-blue-50 text-secondary' : 'bg-emerald-50 text-success'}`}>
                        {encerrado ? 'Encerrado' : futuro ? 'Planejado' : 'Em andamento'}
                    </span>
                    <button data-testid={`calendario-${calendario.id}-editar`} type="button" aria-label={`Editar calendário de ${calendario.ano}`}
                        onClick={() => setEditando(calendario)} disabled={encerrado && calendario.possui_turmas}
                        className="flex size-xl ml-auto rounded-sm border border-slate-200 items-center justify-center text-text-main hover:bg-bg-main disabled:opacity-40 [&>svg]:size-5">
                            <EditIcon />
                        </button>
                </li>;
            })}</ul>
            {!listagem.carregando && !listagem.erro && !listagem.total && <p className="p-lg text-sm text-text-muted">Nenhum calendário cadastrado.</p>}
            <CarregarMais listagem={listagem} testId="calendarios-listagem" />
        </section>
        <Modal testId="calendario-editar" isOpen={Boolean(editando)} onClose={() => setEditando(null)} title="Editar ano letivo" showFooter={false}>
            {editando && <FormularioAnoLetivo key={editando.id} calendario={editando} onSalvo={() => { setEditando(null); listagem.recarregar(); }} />}
        </Modal>
    </div>;
}
