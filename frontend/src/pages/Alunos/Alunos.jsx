import { useToast } from '../../contexts/ToastContext';
import { useState, useRef } from 'react';
import { useListagemInfinita } from '../../hooks/useListagemInfinita';
import { CarregarMais } from '../../components/CarregarMais';
import { FiltroEstado } from "../../components/FiltroEstado";
import { Button } from "../../components/Button";
import { TabelaAlunos } from "./TabelaAlunos";
import { alunoService } from '../../services/alunoService';
import { Input } from "../../components/Input";
import { FormularioAluno } from './FormularioAluno';
import { useAuth } from '../../contexts/AuthContext';
import { ModalConfirmacao } from '../../components/ModalConfirmacao';
import { BotaoExportarCalendario } from '../../components/BotaoExportarCalendario';

export function Alunos() {
    const { notificar } = useToast();
    const [alunoEdicao, setAlunoEdicao] = useState(null);
    const [carregandoEdicao, setCarregandoEdicao] = useState(false);
    const [tentativa, setTentativa] = useState(0);
    const [alunoStatus, setAlunoStatus] = useState(null);
    const [alterandoStatus, setAlterandoStatus] = useState(false);
    const envioStatus = useRef(false);
    const [alunoExclusao, setAlunoExclusao] = useState(null);
    const [excluindo, setExcluindo] = useState(false);
    const envioExclusao = useRef(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [statusSelecionado, setStatusSelecionado] = useState('TODOS');
    const [termoBusca, setTermoBusca] = useState('');
    const { usuario } = useAuth();
    const podeEditar = usuario?.role === 'admin';
    const listagem = useListagemInfinita(alunoService.listarTodos, { busca: termoBusca, status: statusSelecionado }, tentativa);
    const contagemStatus = listagem.contagensStatus ?? { TODOS: 0, ATIVO: 0, INATIVO: 0, RASCUNHO: 0 };

    async function abrirEdicao(aluno) {
        try {
            setCarregandoEdicao(true);
            const dados = await alunoService.buscarPorId(aluno.id);
            setAlunoEdicao(dados);
            setIsModalOpen(true);
        } catch { notificar('Não foi possível carregar o aluno para edição.'); }
        finally { setCarregandoEdicao(false); }
    }
    function abrirModal() { setAlunoEdicao(null); setIsModalOpen(true); }
    function fecharModal() { setIsModalOpen(false); setAlunoEdicao(null); }
    function alunoSalvo() { fecharModal(); setTentativa((v) => v + 1); }

    function abrirStatus(aluno) {
        setAlunoStatus(aluno);
    }

    async function confirmarStatus() {
        if (envioStatus.current || !alunoStatus) return;
        envioStatus.current = true;
        setAlterandoStatus(true);
        const ativando = alunoStatus.status === 'INATIVO';
        try {
            await alunoService.alterarStatus(alunoStatus.id, ativando ? 'ATIVO' : 'INATIVO');
            setAlunoStatus(null);
            notificar(ativando ? 'Aluno ativado com sucesso.' : 'Aluno inativado com sucesso.', 'sucesso');
            setTentativa((atual) => atual + 1);
        } catch (error) {
            notificar(error.response?.data?.erro || 'Não foi possível alterar o status do aluno. Tente novamente.');
        } finally { envioStatus.current = false; setAlterandoStatus(false); }
    }

    function abrirExclusao(aluno) {
        setAlunoExclusao(aluno);
    }

    async function confirmarExclusao() {
        if (envioExclusao.current || !alunoExclusao) return;
        envioExclusao.current = true;
        setExcluindo(true);
        try {
            await alunoService.excluir(alunoExclusao.id);
            setAlunoExclusao(null);
            notificar('Aluno excluído com sucesso.', 'sucesso');
            setTentativa((atual) => atual + 1);
        } catch (error) {
            notificar(error.response?.data?.erro || 'Não foi possível excluir o aluno. Tente novamente.');
        } finally { envioExclusao.current = false; setExcluindo(false); }
    }

    return (
        <div className="flex flex-col gap-lg">
            <div className="flex w-full flex-col gap-sm sm:flex-row sm:items-stretch">
                <FiltroEstado data-testid="alunos-filtro-todos"
                    count={contagemStatus.TODOS}
                    tipo="TODOS"
                    isSelecionado={statusSelecionado === 'TODOS'}
                    aria-pressed={statusSelecionado === 'TODOS'}
                    onClick={() => setStatusSelecionado('TODOS')}
                >
                    Todos
                </FiltroEstado>
                <FiltroEstado data-testid="alunos-filtro-ativo"
                    count={contagemStatus.ATIVO}
                    tipo="ATIVO"
                    isSelecionado={statusSelecionado === 'ATIVO'}
                    aria-pressed={statusSelecionado === 'ATIVO'}
                    onClick={() => setStatusSelecionado('ATIVO')}
                >
                    Ativos
                </FiltroEstado>
                <FiltroEstado data-testid="alunos-filtro-inativo"
                    count={contagemStatus.INATIVO}
                    tipo="INATIVO"
                    isSelecionado={statusSelecionado === 'INATIVO'}
                    aria-pressed={statusSelecionado === 'INATIVO'}
                    onClick={() => setStatusSelecionado('INATIVO')}
                >
                    Inativos
                </FiltroEstado>
                <FiltroEstado data-testid="alunos-filtro-rascunho"
                    count={contagemStatus.RASCUNHO}
                    tipo="RASCUNHO"
                    isSelecionado={statusSelecionado === 'RASCUNHO'}
                    aria-pressed={statusSelecionado === 'RASCUNHO'}
                    onClick={() => setStatusSelecionado('RASCUNHO')}
                >
                    Rascunhos
                </FiltroEstado>
            </div>
            <div className="flex w-full flex-col gap-sm sm:flex-row sm:items-stretch">
                <Input data-testid="alunos-busca"
                    placeholder="Pesquisar por nome do aluno ou responsável..."
                    aria-label="Pesquisar por nome do aluno ou responsável"
                    value={termoBusca}
                    onChange={(event) => setTermoBusca(event.target.value)}
                    icon={
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2">
                            <path d="M6.23896 10.9637C8.74484 10.9637 10.7763 8.93233 10.7763 6.42645C10.7763 3.92056 8.74484 1.88914 6.23896 1.88914C3.73308 1.88914 1.70166 3.92056 1.70166 6.42645C1.70166 8.93233 3.73308 10.9637 6.23896 10.9637Z" stroke="#1A202C" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M11.9105 12.0981L9.44336 9.63091" stroke="#1A202C" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    }
                />
                {podeEditar && <Button data-testid="alunos-novo" className="shrink-0" onClick={abrirModal}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M6.99365 2.914V11.0732" stroke="white" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2.91406 6.99361H11.0733" stroke="white" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Novo Aluno
                </Button>}
                {isModalOpen && podeEditar && <FormularioAluno aluno={alunoEdicao} onClose={fecharModal} onSalvo={alunoSalvo} />}
            </div>
            {carregandoEdicao && <p role="status">Carregando dados para edição...</p>}
            <div className="overflow-hidden rounded-md border border-slate-200 bg-bg-surface shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-md border-b border-slate-200 px-lg py-md">
                    <p className="text-sm text-text-muted">{listagem.total} alunos na seleção atual</p>
                    <BotaoExportarCalendario testId="alunos-exportar-calendarios" total={listagem.total} disabled={listagem.carregando || Boolean(listagem.erro)} filtros={{ busca: termoBusca, status: statusSelecionado }} />
                </div>
                {!listagem.carregando && !listagem.erro && <TabelaAlunos semBorda alunos={listagem.itens} onAcao={podeEditar && !carregandoEdicao ? abrirEdicao : undefined}
                onAlterarStatus={podeEditar && !carregandoEdicao ? abrirStatus : undefined}
                onExcluir={podeEditar && !carregandoEdicao ? abrirExclusao : undefined} alterandoStatus={alterandoStatus || excluindo} />}
            </div>
            <CarregarMais testId="alunos-paginacao" listagem={listagem} />
            {podeEditar && alunoExclusao && <ModalConfirmacao testId="aluno-excluir" isOpen estado="atencao" showCancel
                title="Excluir aluno?" confirmText="Confirmar exclusão" isConfirmLoading={excluindo} onConfirm={confirmarExclusao}
                onClose={() => { if (!envioExclusao.current) setAlunoExclusao(null); }}
                description={<>Deseja excluir o aluno <strong>{alunoExclusao.nome}</strong>? Essa ação não pode ser desfeita.
                </>} />}
            {podeEditar && alunoStatus && <ModalConfirmacao testId="aluno-alterar-status" isOpen
                onClose={() => { if (!envioStatus.current) setAlunoStatus(null); }}
                estado={alunoStatus.status === 'INATIVO' ? 'confirmacao' : 'atencao'} showCancel
                title={alunoStatus.status === 'INATIVO' ? 'Ativar aluno?' : 'Inativar aluno?'}
                confirmText={alunoStatus.status === 'INATIVO' ? 'Confirmar ativação' : 'Confirmar inativação'}
                isConfirmLoading={alterandoStatus} onConfirm={confirmarStatus}
                description={<>Deseja {alunoStatus.status === 'INATIVO' ? 'ativar' : 'inativar'} <strong>{alunoStatus.nome}</strong>?{' '}
                    {alunoStatus.status === 'INATIVO'
                        ? 'Ele voltará a ser elegível para turmas e atendimentos.'
                        : 'As matrículas e os atendimentos serão encerrados.'}
                </>} />}
        </div>
    )
}
