import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { CarregarMais } from '../../components/CarregarMais';
import EditIcon from '../../components/icons/EditIcon';
import { useListagemInfinita } from '../../hooks/useListagemInfinita';
import { anosLetivosService } from '../../services/anosLetivosService';
import { hojeInstituicao, periodoLetivo } from '../../utils/anoLetivo';
import { FormularioAnoLetivo } from './FormularioAnoLetivo';
import { CardConfiguracao } from './CardConfiguracao';
import { FormularioModalidade } from './FormularioModalidade';
import { modalidadesService } from '../../services/modalidadesService';

export function Configuracoes() {
    const [editando, setEditando] = useState(null);
    const listagem = useListagemInfinita(anosLetivosService.listarPagina);
    const modalidades = useListagemInfinita(modalidadesService.listarPagina);
    const hoje = hojeInstituicao();

    return <div className="flex flex-col gap-lg">
        <header>
            <h1 id="alunos-titulo" className="text-xl font-bold text-text-main">Configurações</h1>
        </header>
        <div className='flex flex-row gap-lg'>
            <div className='flex flex-col gap-lg w-[50%]'>
                <CardConfiguracao titulo="Cadastrar ano letivo" descricao="Registre as datas oficiais de início e encerramento.">
                    <FormularioAnoLetivo onSalvo={listagem.recarregar} />
                </CardConfiguracao>
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
            </div>
            <div className='flex flex-col gap-lg w-[50%]'>
                <CardConfiguracao titulo="Cadastrar modalidade" descricao="Cadastre as modalidades dos atendimentos clínicos.">
                    <FormularioModalidade onSalvo={modalidades.recarregar} />
                </CardConfiguracao>
                <CardConfiguracao titulo="Modalidades cadastradas" descricao="As modalidades cadastradas não podem ser editadas." conteudoComPadding={false}>
                    <ul className="divide-y divide-slate-200">{modalidades.itens.map((modalidade) => <li key={modalidade.id} className="p-lg text-sm font-semibold text-text-main">{modalidade.nome}</li>)}</ul>
                    {!modalidades.carregando && !modalidades.erro && !modalidades.total && <p className="p-lg text-sm text-text-muted">Nenhuma modalidade cadastrada.</p>}
                    <CarregarMais listagem={modalidades} testId="modalidades-listagem" />
                </CardConfiguracao>
            </div>
        </div>
        <Modal testId="calendario-editar" isOpen={Boolean(editando)} onClose={() => setEditando(null)} title="Editar ano letivo" showFooter={false}>
            {editando && <FormularioAnoLetivo key={editando.id} calendario={editando} onSalvo={() => { setEditando(null); listagem.recarregar(); }} />}
        </Modal>
    </div>;
}
