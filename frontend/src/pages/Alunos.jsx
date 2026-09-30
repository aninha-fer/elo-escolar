import { FiltroEstado } from "../components/FiltroEstado";
import { Button } from "../components/Button";
import { TabelaAlunos } from "../components/TabelaAlunos";
import { useState, useEffect } from 'react';
import { alunoService } from '../services/alunoService';
import { Modal } from "../components/Modal";
import { Input } from "../components/Input";

export function Alunos() {
    const [alunos, setAlunos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modalView, setModalView] = useState('selecao');

    useEffect(() => {
        const controller = new AbortController();

        async function carregarAlunos() {
            try {
                setLoading(true);
                setError(null);

                const dados = await alunoService.listarTodos({}, controller.signal);
                setAlunos(dados);
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;

                const mensagemErro = err.response?.data?.erro || 'Não foi possível carregar a lista de alunos.';
                setError(mensagemErro);
            } finally {
                setLoading(false);
            }
        }

        carregarAlunos();

        return () => controller.abort();
    }, []);

    if (loading) return <div className="p-4">Carregando alunos...</div>;
    if (error) return <div className="p-4 text-red-600 bg-red-50 rounded">{error}</div>;

    function abrirModal() {
        setModalView('selecao');
        setIsModalOpen(true);
    }

    function fecharModal() {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setModalView('selecao');
    }

    function confirmarModal(event) {
        if (modalView === 'conflitos') {
            setModalView('selecao');
            return;
        }

        // handleMatriculas(event);
    }


    return (
        <div className="flex flex-col gap-lg">
            <div className="flex w-full flex-col gap-sm sm:flex-row sm:items-stretch">
                <FiltroEstado count={1} tipo={"TODOS"} isSelecionado={true}>
                    Todos
                </FiltroEstado>
                <FiltroEstado count={1} tipo={"ATIVO"} isSelecionado={false}>
                    Ativos
                </FiltroEstado>
                <FiltroEstado count={0} tipo={"INATIVO"} isSelecionado={false}>
                    Inativos
                </FiltroEstado>
                <FiltroEstado count={0} tipo={"RASCUNHO"} isSelecionado={false}>
                    Rascunhos
                </FiltroEstado>
            </div>
            <div className="flex w-full flex-col gap-sm sm:flex-row sm:items-stretch">
                <Input placeholder={'Pesquisar por nome ou responsável...'} icon={
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2">
                        <path d="M6.23896 10.9637C8.74484 10.9637 10.7763 8.93233 10.7763 6.42645C10.7763 3.92056 8.74484 1.88914 6.23896 1.88914C3.73308 1.88914 1.70166 3.92056 1.70166 6.42645C1.70166 8.93233 3.73308 10.9637 6.23896 10.9637Z" stroke="#1A202C" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M11.9105 12.0981L9.44336 9.63091" stroke="#1A202C" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                }/>
                <Button className="shrink-0" onClick={abrirModal}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M6.99365 2.914V11.0732" stroke="white" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2.91406 6.99361H11.0733" stroke="white" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Novo Aluno
                </Button>
                <Modal isOpen={isModalOpen}
                    onClose={fecharModal}
                    title="Cadastrar Novo Aluno"
                    subtitle="Campos com * são obrigatórios para o cadastro"
                    confirmText={'Salvar Aluno'}
                    cancelText="Cancelar"
                    onConfirm={confirmarModal}
                    isConfirmLoading={isSubmitting}> 
                    <Input type={"text"} label={'Nome Completo'} placeholder={'Ex: Lucas Andrade'} required/>
                    <div className="flex flex-row gap-md">
                        <Input type={"text"} label={'Telefone'} placeholder={'(11) 1 1111-1111'} />                 
                        <Input type={"date"} label={'Data de nascimento'} />                 
                    </div>     
                    <div className="flex flex-row gap-md">
                        <Input type={"text"} label={'Nome do Responsável'} placeholder={'Ex: Roberto Andrade'} />                 
                        <Input type={"text"} label={'Telefone do Responsável'} placeholder={'(11) 1 1111-1111'} />                 
                    </div>
                    <div className="border-gray-200 border-b w-full py-sm mb-md">
                        <h3 className="font-semibold text-[14px] text-text-main px-1">Frequência</h3>
                    </div>            
                </Modal>
            </div>
            <TabelaAlunos alunos={alunos} />
        </div>
    )
}