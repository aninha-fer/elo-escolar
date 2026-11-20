import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuth } from '../../contexts/AuthContext';
import { AlternadorTipoTurma } from './AlternadorTipoTurma';
import { turmasService } from '../../services/turmasService';
import { TurmaItem } from './TurmaItem';
import { normalizarProfissionais } from '../../utils/formatters';
import { FormularioTurma } from './FormularioTurma';
import { ModalConfirmacao } from '../../components/ModalConfirmacao';

function normalizarTexto(valor = '') {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function Turmas() {
    const navigate = useNavigate();
    const [tipoTurma, setTipoTurma] = useState('REGULAR');
    const [resultado, setResultado] = useState({ tipo: 'REGULAR', tentativa: 0, status: 'carregando', turmas: [] });
    const [tentativa, setTentativa] = useState(0);
    const [termoBusca, setTermoBusca] = useState('');
    const [aviso, setAviso] = useState('');
    const { usuario } = useAuth();
    const podeEditar = usuario?.role === 'admin';
    const [modalAberto, setModalAberto] = useState(false);
    const [operacao, setOperacao] = useState(null);
    const [alterandoStatus, setAlterandoStatus] = useState(false);
    const [erroStatus, setErroStatus] = useState('');
    const envioStatusEmAndamento = useRef(false);


    useEffect(() => {
        const controller = new AbortController();
        async function carregarTurmas() {
            try {
                const dados = tipoTurma === 'REGULAR'
                    ? await turmasService.listarRegularesDisponiveis(controller.signal)
                    : await turmasService.listarOficinasDisponiveis(controller.signal);
                if (!controller.signal.aborted) {
                    setResultado({ tipo: tipoTurma, tentativa, status: 'sucesso', turmas: dados.map((turma) => ({ ...turma, profissionais: normalizarProfissionais(turma) })) });
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    setResultado({ tipo: tipoTurma, tentativa, status: 'erro', turmas: [], erro: error.response?.data?.erro || 'Não foi possível carregar as turmas. Tente novamente.' });
                }
            }
        }
        carregarTurmas();
        return () => controller.abort();
    }, [tipoTurma, tentativa]);

    const carregando = resultado.tipo !== tipoTurma || resultado.tentativa !== tentativa || resultado.status === 'carregando';
    const erro = !carregando && resultado.status === 'erro' ? resultado.erro : '';
    const busca = normalizarTexto(termoBusca);
    const filtrados = resultado.turmas.filter((turma) => normalizarTexto(turma.nome).includes(busca));

    function trocarTipo(tipo) {
        setTipoTurma(tipo);
        setAviso('');
    }

    function tentarNovamente() {
        setTentativa((atual) => atual + 1);
    }

    function turmaCriada(turma) {
        setTipoTurma(turma.tipo);
        setTentativa((atual) => atual + 1);
        setTermoBusca('');
        setModalAberto(false);
        setAviso(turma.tipo === 'REGULAR' ? 'Turma cadastrada com sucesso.' : 'Oficina cadastrada com sucesso.');
    }

    async function abrirOperacao(tipo, turma) {
        setAviso('');
        setErroStatus('');
        setOperacao({ tipo, turma });
        if (tipo === 'editar' || tipo === 'nova-a-partir' || (tipo === 'status' && turma.status === 'INATIVO')) return;
        envioStatusEmAndamento.current = true;
        setAlterandoStatus(true);
        try {
            const atual = await turmasService.buscarPorId(turma.id);
            setOperacao({ tipo, turma: { ...turma, ...atual }, confirmacao: atual.confirmacao_cancelamentos });
        } catch (error) {
            setErroStatus(error.response?.data?.erro || 'Não foi possível consultar as matrículas. Feche e tente novamente.');
        } finally {
            envioStatusEmAndamento.current = false;
            setAlterandoStatus(false);
        }
    }

    function turmaAtualizada(turma, mensagem) {
        setTipoTurma(turma.tipo);
        setOperacao(null);
        setTentativa((atual) => atual + 1);
        setAviso(mensagem);
    }

    function fecharConfirmacao() {
        if (!envioStatusEmAndamento.current) setOperacao(null);
    }

    async function confirmarStatus() {
        if (envioStatusEmAndamento.current || operacao?.tipo !== 'status') return;
        const ativando = operacao.turma.status === 'INATIVO';
        envioStatusEmAndamento.current = true;
        setAlterandoStatus(true);
        setErroStatus('');
        try {
            const atualizada = await turmasService.editar(operacao.turma.id, { status: ativando ? 'ATIVO' : 'INATIVO',
                ...(!ativando ? { confirmar_cancelamentos: operacao.confirmacao } : {}) });
            turmaAtualizada(atualizada, ativando ? 'Turma ativada com sucesso.' : 'Turma inativada com sucesso.');
        } catch (error) {
            atualizarConfirmacao(error);
            setErroStatus(error.response?.data?.erro || 'Não foi possível alterar o status da turma. Tente novamente.');
        } finally {
            envioStatusEmAndamento.current = false;
            setAlterandoStatus(false);
        }
    }

    function atualizarConfirmacao(error) {
        const dados = error.response?.data;
        if (dados?.confirmacao) setOperacao((atual) => ({ ...atual, confirmacao: dados.confirmacao,
            turma: { ...atual.turma, matriculas_ativas: dados.matriculas_ativas } }));
    }

    async function confirmarExclusao() {
        if (envioStatusEmAndamento.current || operacao?.tipo !== 'excluir' || !operacao.confirmacao) return;
        envioStatusEmAndamento.current = true;
        setAlterandoStatus(true);
        setErroStatus('');
        try {
            await turmasService.excluir(operacao.turma.id, { confirmar_cancelamentos: operacao.confirmacao });
            turmaAtualizada(operacao.turma, 'Turma excluída com sucesso.');
        } catch (error) {
            atualizarConfirmacao(error);
            setErroStatus(error.response?.data?.erro || 'Não foi possível excluir a turma. Tente novamente.');
        } finally {
            envioStatusEmAndamento.current = false;
            setAlterandoStatus(false);
        }
    }

    return (
        <section className="flex min-w-0 flex-col gap-lg" aria-labelledby="turmas-titulo">
            <h1 id="turmas-titulo" className="text-xl font-bold text-text-main">Turmas</h1>
            <div>
                <div className="flex w-full flex-col gap-sm sm:flex-row sm:items-stretch">
                    <Input data-testid="turmas-busca" placeholder="Pesquisar por nome..." aria-label="Pesquisar por nome"
                        value={termoBusca} onChange={(event) => setTermoBusca(event.target.value)}
                        icon={
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M6.23896 10.9637C8.74484 10.9637 10.7763 8.93233 10.7763 6.42645C10.7763 3.92056 8.74484 1.88914 6.23896 1.88914C3.73308 1.88914 1.70166 3.92056 1.70166 6.42645C1.70166 8.93233 3.73308 10.9637 6.23896 10.9637Z" stroke="currentColor" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M11.9105 12.0981L9.44336 9.63091" stroke="currentColor" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        } />
                    {podeEditar && <Button data-testid="turmas-nova" type="button"
                        onClick={() => { setAviso(''); setModalAberto(true); }}>
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M6.99365 2.914V11.0732M2.91406 6.99361H11.0733" stroke="currentColor" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {tipoTurma === 'REGULAR' ? 'Nova Turma' : 'Nova Oficina'}
                    </Button>}
                </div>
                <AlternadorTipoTurma value={tipoTurma} onChange={trocarTipo} />
            </div>
            {aviso && <p role="status" className="rounded-sm bg-emerald-50 p-md text-sm text-emerald-700">{aviso}</p>}
            {carregando ? <p role="status">Carregando {tipoTurma === 'REGULAR' ? 'turmas regulares' : 'oficinas'}...</p> : erro ? (
                <div className="rounded-sm bg-red-50 p-md text-sm text-red-700">
                    <p role="alert">{erro}</p>
                    <button data-testid="turmas-tentar-novamente" type="button" onClick={tentarNovamente} className="mt-sm rounded-sm border border-danger px-sm py-xs font-semibold">Tentar novamente</button>
                </div>
            ) : filtrados.length === 0 ? (
                <p role="status" className="rounded-md border border-slate-200 bg-bg-surface px-lg py-10 text-center text-sm text-slate-500">
                    {tipoTurma === 'REGULAR' ? 'Nenhuma turma regular encontrada.' : 'Nenhuma oficina encontrada.'}
                </p>
            ) : (
                <ul aria-label={tipoTurma === 'REGULAR' ? 'Turmas regulares' : 'Oficinas'} className="flex min-w-0 flex-col gap-sm">
                    {filtrados.map((turma) => <TurmaItem key={turma.id} turma={turma} profissionais={turma.profissionais} podeEditar={podeEditar}
                        onEditar={(selecionada) => abrirOperacao('editar', selecionada)} onAlterarStatus={(selecionada) => abrirOperacao('status', selecionada)}
                        onExcluir={(selecionada) => abrirOperacao('excluir', selecionada)}
                        onCriarAPartir={(selecionada) => abrirOperacao('nova-a-partir', selecionada)}
                        onSelecionar={(selecionada) => navigate(`/turmas/${selecionada.id}`)} />)}
                </ul>
            )}
            {modalAberto && podeEditar && <FormularioTurma tipoInicial={tipoTurma} onClose={() => setModalAberto(false)} onCriado={turmaCriada} />}
            {operacao?.tipo === 'nova-a-partir' && podeEditar && <FormularioTurma key={operacao.turma.id} turmaOrigem={operacao.turma}
                onClose={() => setOperacao(null)} onCriado={(turma) => turmaAtualizada(turma, 'Nova turma criada com sucesso.')} />}
            {operacao?.tipo === 'editar' && podeEditar && <FormularioTurma key={operacao.turma.id} turma={operacao.turma}
                onClose={() => setOperacao(null)} onSalvo={(turma) => turmaAtualizada(turma, 'Turma atualizada com sucesso.')} />}
            {operacao?.tipo === 'status' && podeEditar && <ModalConfirmacao testId="turma-alterar-status" isOpen onClose={fecharConfirmacao} showCancel
                estado={operacao.turma.status === 'INATIVO' ? 'confirmacao' : 'atencao'}
                title={operacao.turma.status === 'INATIVO' ? 'Ativar turma?' : 'Inativar turma?'}
                description={<>
                    Deseja {operacao.turma.status === 'INATIVO' ? 'ativar' : 'inativar'} a turma <strong>{operacao.turma.nome}</strong>?
                    {operacao.turma.status !== 'INATIVO' && operacao.confirmacao && <> Essa turma possui {operacao.turma.matriculas_ativas} matrículas ativas que serão canceladas.</>}
                    {erroStatus && <span role="alert" className="mt-md block text-sm text-red-700">{erroStatus}</span>}
                </>}
                confirmText={operacao.turma.status === 'INATIVO' ? 'Confirmar ativação' : 'Confirmar inativação'}
                onConfirm={confirmarStatus} isConfirmLoading={alterandoStatus}
                isConfirmDisabled={operacao.turma.status !== 'INATIVO' && !operacao.confirmacao} />}
            {operacao?.tipo === 'excluir' && podeEditar && <ModalConfirmacao testId="turma-excluir" isOpen onClose={fecharConfirmacao}
                estado="atencao" showCancel title="Excluir turma?" confirmText="Confirmar exclusão"
                description={<>
                    Deseja excluir a turma <strong>{operacao.turma.nome}</strong>? Essa turma possui {operacao.turma.matriculas_ativas ?? operacao.turma.vagas_ocupadas ?? 0} matrículas ativas que serão canceladas. Essa ação não pode ser desfeita.
                    {operacao.confirmacao?.matriculas.length > (operacao.turma.matriculas_ativas ?? 0) && <span className="mt-sm block">Os vínculos provisórios também serão encerrados.</span>}
                    {erroStatus && <span role="alert" className="mt-md block text-sm text-red-700">{erroStatus}</span>}
                </>}
                onConfirm={confirmarExclusao} isConfirmLoading={alterandoStatus} isConfirmDisabled={!operacao.confirmacao} />}
        </section>
    );
}
