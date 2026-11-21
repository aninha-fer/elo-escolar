import { useToast } from '../../contexts/ToastContext';
import { useRef, useState } from 'react';
import { useListagemInfinita } from '../../hooks/useListagemInfinita';
import { CarregarMais } from '../../components/CarregarMais';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { profissionaisService } from '../../services/profissionaisService';
import { TabelaProfissionais } from './TabelaProfissionais';
import { FormularioProfissional } from './FormularioProfissional';
import { ModalConfirmacao } from '../../components/ModalConfirmacao';

function VinculosProfissional({ conflitos }) {
    const turmas = conflitos.filter((item) => item.codigo === 'TURMA_VINCULADA' && item.turma_nome);
    const atendimentos = conflitos.filter((item) => item.codigo === 'ATENDIMENTO_VINCULADO' && item.modalidade && item.aluno_nome);
    const restantes = conflitos.filter((item) => !turmas.includes(item) && !atendimentos.includes(item));

    return <>
        {turmas.length > 0 && <span className="mt-xs block">Responsável pela(s) turma(s): {turmas.map((item) => item.turma_nome).join(', ')}.</span>}
        {atendimentos.length > 0 && <span className="mt-xs block">Responsável pelo(s) atendimento(s): {atendimentos.map((item) => `${item.modalidade} (${item.aluno_nome})`).join(', ')}.</span>}
        {restantes.map((item, indice) => <span key={indice} className="mt-xs block">{item.mensagem}</span>)}
    </>;
}

export function Profissionais() {
    const { notificar } = useToast();
    const [tentativa, setTentativa] = useState(0);
    const [busca, setBusca] = useState('');
    const [modalAberto, setModalAberto] = useState(false);
    const [operacao, setOperacao] = useState(null);
    const [alterandoStatus, setAlterandoStatus] = useState(false);
    const [erroStatus, setErroStatus] = useState('');
    const [conflitos, setConflitos] = useState([]);
    const envioStatusEmAndamento = useRef(false);

    const listagem = useListagemInfinita(profissionaisService.listarPaginados, { busca }, tentativa);
    const { itens: profissionais, carregando, erro } = listagem;

    function tentarNovamente() {
        setTentativa((atual) => atual + 1);
    }

    function profissionalCriado() {
        setTentativa((atual) => atual + 1);
        setModalAberto(false);
        notificar('Profissional cadastrado com sucesso.', 'sucesso');
    }

    function abrirOperacao(tipo, profissional) {
        setErroStatus('');
        setConflitos([]);
        setOperacao({ tipo, profissional });
    }

    function profissionalAtualizado(profissional, mensagem) {
        setTentativa((atual) => atual + 1);
        setOperacao(null);
        notificar(mensagem, 'sucesso');
    }

    function fecharConfirmacao() {
        if (!envioStatusEmAndamento.current) setOperacao(null);
    }

    async function confirmarStatus() {
        if (envioStatusEmAndamento.current || operacao?.tipo !== 'status') return;
        const ativando = operacao.profissional.status_geral === 'INATIVO';
        envioStatusEmAndamento.current = true;
        setAlterandoStatus(true);
        setErroStatus('');
        setConflitos([]);
        try {
            const atualizado = await profissionaisService.editar(operacao.profissional.id, { status_geral: ativando ? 'ATIVO' : 'INATIVO' });
            profissionalAtualizado(atualizado, ativando ? 'Profissional ativado com sucesso.' : 'Profissional inativado com sucesso.');
        } catch (error) {
            const mensagemErro = error.response?.data?.erro || 'Não foi possível alterar o status do profissional. Tente novamente.';
            if (error.response?.data?.conflitos?.length) setErroStatus(mensagemErro);
            else notificar(mensagemErro);
            setConflitos(error.response?.data?.conflitos ?? []);
        } finally {
            envioStatusEmAndamento.current = false;
            setAlterandoStatus(false);
        }
    }

    async function confirmarExclusao() {
        if (envioStatusEmAndamento.current || operacao?.tipo !== 'excluir') return;
        envioStatusEmAndamento.current = true;
        setAlterandoStatus(true);
        setErroStatus('');
        setConflitos([]);
        try {
            await profissionaisService.excluir(operacao.profissional.id);
            setTentativa((atual) => atual + 1);
            setOperacao(null);
            notificar('Profissional excluído com sucesso.', 'sucesso');
        } catch (error) {
            const mensagemErro = error.response?.data?.erro || 'Não foi possível excluir o profissional. Tente novamente.';
            if (error.response?.data?.conflitos?.length) setErroStatus(mensagemErro);
            else notificar(mensagemErro);
            setConflitos(error.response?.data?.conflitos ?? []);
        } finally { envioStatusEmAndamento.current = false; setAlterandoStatus(false); }
    }

    return (
        <section className="profissionais-page flex min-w-0 flex-col gap-lg" aria-labelledby="profissionais-titulo">
            <h1 id="profissionais-titulo" className="text-xl font-bold text-text-main">Profissionais</h1>
            <div className="flex flex-col gap-sm sm:flex-row sm:items-start">
                <Input data-testid="profissionais-busca" id="busca-profissional" placeholder="Buscar por nome..." aria-label="Buscar profissional por nome"
                    wrapperClassName="mb-0! min-w-0" inputClassName="h-11" value={busca} onChange={(event) => setBusca(event.target.value)}
                    icon={
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                            <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" />
                        </svg>
                    } />
                <Button data-testid="profissionais-novo" type="button" className="novo-profissional disabled:cursor-not-allowed disabled:opacity-50" disabled={carregando || Boolean(erro)}
                    onClick={() => { setModalAberto(true); }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
                    Novo Profissional
                </Button>
            </div>
            {carregando ? <p role="status">Carregando profissionais...</p> : erro ? (
                <div className="rounded-sm bg-red-50 p-md text-sm text-red-700">
                    <p role="alert">{erro}</p>
                    <button data-testid="profissionais-tentar-novamente" type="button" className="mt-sm rounded-sm border border-danger px-sm py-xs font-semibold" onClick={tentarNovamente}>Tentar novamente</button>
                </div>
            ) : <TabelaProfissionais profissionais={profissionais} onEditar={(profissional) => abrirOperacao('editar', profissional)}
                onAlterarStatus={(profissional) => abrirOperacao('status', profissional)}
                onExcluir={(profissional) => abrirOperacao('excluir', profissional)} />}
            {!carregando && !erro && <CarregarMais testId="profissionais-paginacao" listagem={listagem} />}
            {modalAberto && <FormularioProfissional onClose={() => setModalAberto(false)} onCriado={profissionalCriado} />}
            {operacao?.tipo === 'editar' && <FormularioProfissional key={operacao.profissional.id} profissional={operacao.profissional}
                onClose={() => setOperacao(null)} onSalvo={(profissional) => profissionalAtualizado(profissional, 'Profissional atualizado com sucesso.')} />}
            {operacao?.tipo === 'excluir' && <ModalConfirmacao testId="profissional-excluir" isOpen estado="atencao" showCancel
                title="Excluir funcionário?" confirmText="Confirmar exclusão" onClose={fecharConfirmacao}
                onConfirm={confirmarExclusao} isConfirmLoading={alterandoStatus}
                description={<>Deseja excluir o funcionário <strong>{operacao.profissional.nome}</strong>? Essa ação não pode ser desfeita.
                    {erroStatus && <span role="alert" className="mt-md block text-sm text-red-700">{erroStatus}
                        <VinculosProfissional conflitos={conflitos} />
                    </span>}
                </>} />}
            {operacao?.tipo === 'status' && <ModalConfirmacao testId="profissional-alterar-status" isOpen onClose={fecharConfirmacao} showCancel
                estado={operacao.profissional.status_geral === 'INATIVO' ? 'confirmacao' : 'atencao'}
                title={operacao.profissional.status_geral === 'INATIVO' ? 'Ativar profissional?' : 'Inativar profissional?'}
                description={<>
                    Deseja {operacao.profissional.status_geral === 'INATIVO' ? 'ativar' : 'inativar'} o profissional <strong>{operacao.profissional.nome}</strong>?
                    {' '}O status do usuário vinculado também será atualizado, se houver.
                    {operacao.profissional.status_geral !== 'INATIVO'}
                    {erroStatus && <span role="alert" className="mt-md block text-sm text-red-700">{erroStatus}
                        <VinculosProfissional conflitos={conflitos} />
                    </span>}
                </>}
                confirmText={operacao.profissional.status_geral === 'INATIVO' ? 'Confirmar ativação' : 'Confirmar inativação'}
                onConfirm={confirmarStatus} isConfirmLoading={alterandoStatus} />}
        </section>
    );
}
