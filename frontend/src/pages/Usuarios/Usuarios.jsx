import { Button } from "../../components/Button";
import { TabelaUsuarios } from "./TabelaUsuarios";
import { useState, useRef } from 'react';
import { Modal } from "../../components/Modal";
import { Input } from "../../components/Input";
import { Select } from "../../components/Select";

const formularioInicial = {
    nome: '',
    telefone: '',
    data_nascimento: '',
    responsaveis: [],
    participa_procan: false,
    observacoes: '',
    dados_medicos: {
        restricao_alimentar: '', autorizado_atividade_fisica: '', usa_medicamento: '',
        medicamentos_descricao: '', autorizacao_analgesico: '',
    },
    turno: '',
    dias_frequencia: [],
    participa_almoco: false,
    turma_id: '',
};

function normalizarTexto(valor = '') {
    return String(valor)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR')
        .trim();
}

export function Usuarios() {
    const [formulario, setFormulario] = useState(formularioInicial);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [termoBusca, setTermoBusca] = useState('');
    const enviando = useRef(false);

    function atualizarCampo(campo, valor) {
        setFormulario((atual) => ({
            ...atual,
            [campo]: valor,
        }));
    }

    function resetarFormulario() {
        setFormulario(formularioInicial);
        setSubmitError('');
    }

    function abrirModal() {
        resetarFormulario();
        setIsModalOpen(true);
    }

    function fecharModal() {
        if (enviando.current) return;
        setIsModalOpen(false);
        resetarFormulario();
    }

    function handleSubmit(event) {

    }



    return (
        <div className="flex flex-col gap-lg">
            <div className="flex w-full flex-col gap-sm sm:flex-row sm:items-stretch">
                <Input
                    placeholder="Pesquisar por nome ou email..."
                    aria-label="Pesquisar por nome ou email"
                    value={termoBusca}
                    onChange={(event) => setTermoBusca(event.target.value)}
                    icon={
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2">
                        <path d="M6.23896 10.9637C8.74484 10.9637 10.7763 8.93233 10.7763 6.42645C10.7763 3.92056 8.74484 1.88914 6.23896 1.88914C3.73308 1.88914 1.70166 3.92056 1.70166 6.42645C1.70166 8.93233 3.73308 10.9637 6.23896 10.9637Z" stroke="#1A202C" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M11.9105 12.0981L9.44336 9.63091" stroke="#1A202C" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    }
                />
                <Button className="shrink-0" onClick={abrirModal}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M6.99365 2.914V11.0732" stroke="white" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2.91406 6.99361H11.0733" stroke="white" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Novo Usuário
                </Button>
                <Modal isOpen={isModalOpen}
                    onClose={fecharModal}
                    title="Novo usuário"
                    subtitle="Defina os dados de acesso e o nível de permissão."
                    confirmText={'Criar usuário'}
                    cancelText="Cancelar"
                    confirmFormId=""
                    onConfirm={handleSubmit}
                    isConfirmLoading={isSubmitting}>
                    <form id="" onSubmit={handleSubmit}>
                        <fieldset disabled={isSubmitting} className="min-w-0">
                        <Input
                            id="nome-completo"
                            name="nome"
                            type="text"
                            label="Nome Completo"
                            placeholder="Ex: Maria da Silva"
                            value={formulario.nome}
                            onChange={(event) => atualizarCampo('nome', event.target.value)}
                            required
                        />
                        <Input id="email" name="email" label="E-mail" placeholder="Ex: nome@apae.com" type="email" value={formulario.email} onChange={(event) => atualizarCampo('email', event.target.value)} required/>
                        <Select id="role" name="role" label="Função" placeholder="— Não informado —"
                            value={formulario.role} onChange={(event) => atualizarCampo('role', event.target.value)}
                            required
                            options={[{ value: 'professor', label: 'Professor' }, { value: 'admin', label: 'Administrador' }]} />
                        {submitError && (
                            <p role="alert" className="mb-md rounded-sm bg-red-50 p-sm text-sm text-red-700">
                                {submitError}
                            </p>
                        )}
                        </fieldset>
                    </form>
                </Modal>
            </div>
            <TabelaUsuarios usuarios={''} />
        </div>
    )
}
