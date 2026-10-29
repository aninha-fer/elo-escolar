import { FiltroEstado } from "../components/FiltroEstado";
import { Button } from "../components/Button";
import { TabelaAlunos } from "../components/TabelaAlunos";
import { useState, useEffect, useRef } from 'react';
import { alunoService } from '../services/alunoService';
import { Modal } from "../components/Modal";
import { Input } from "../components/Input";
import { SelecaoOpcao } from "../components/SelecaoOpcao";
import { SelecaoDiasSemana } from "../components/SelecaoDiasSemana";
import { Select } from "../components/Select";
import { Toggle } from "../components/Toggle";
import { turmasService } from "../services/turmasService";
import { formatarTurno } from "../utils/formatters";

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

export function Alunos() {
    const [alunos, setAlunos] = useState([]);
    const [turmas, setTurmas] = useState([]);
    const [formulario, setFormulario] = useState(formularioInicial);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [statusSelecionado, setStatusSelecionado] = useState('TODOS');
    const [termoBusca, setTermoBusca] = useState('');
    const sequenciaResponsavel = useRef(0);
    const enviando = useRef(false);

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

        async function carregarTurmasRegularesPorTurno(turno) {
            try {
                const dados = await turmasService.listarTurmasRegularesPorTurno(controller.signal, turno);
                setTurmas(dados);
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
                setError('Não foi possível carregar as turmas regulares disponíveis.');
            }
        }
        carregarTurmasRegularesPorTurno();

        return () => controller.abort();
    }, []);

    const contagemStatus = alunos.reduce((contagem, aluno) => {
        const status = aluno.status ?? 'RASCUNHO';
        contagem.TODOS += 1;

        if (Object.hasOwn(contagem, status)) {
            contagem[status] += 1;
        }

        return contagem;
    }, { TODOS: 0, ATIVO: 0, INATIVO: 0, RASCUNHO: 0 });

    const termoNormalizado = normalizarTexto(termoBusca);
    const alunosFiltrados = alunos.filter((aluno) => {
        const statusCorresponde = statusSelecionado === 'TODOS'
            || (aluno.status ?? 'RASCUNHO') === statusSelecionado;
        const nomeCorresponde = !termoNormalizado
            || normalizarTexto(aluno.nome).includes(termoNormalizado)
            || (aluno.responsaveis ?? []).some((responsavel) => normalizarTexto(responsavel.nome).includes(termoNormalizado));

        return statusCorresponde && nomeCorresponde;
    });

    if (loading) return <div className="p-4">Carregando alunos...</div>;
    if (error) return <div className="p-4 text-red-600 bg-red-50 rounded">{error}</div>;

    function atualizarCampo(campo, valor) {
        setFormulario((atual) => ({
            ...atual,
            [campo]: valor,
            ...(campo === 'turno' ? { turma_id: '' } : {}),
        }));
    }

    function resetarFormulario() {
        setFormulario(formularioInicial);
        setSubmitError('');
    }

    function adicionarResponsavel() {
        const chave = sequenciaResponsavel.current++;
        setFormulario((atual) => ({ ...atual, responsaveis: [...atual.responsaveis, { chave, nome: '', parentesco: '', telefone: '' }] }));
    }

    function atualizarResponsavel(chave, campo, valor) {
        setFormulario((atual) => ({ ...atual, responsaveis: atual.responsaveis.map((responsavel) =>
            responsavel.chave === chave ? { ...responsavel, [campo]: valor } : responsavel) }));
    }

    function removerResponsavel(chave) {
        setFormulario((atual) => ({ ...atual, responsaveis: atual.responsaveis.filter((responsavel) => responsavel.chave !== chave) }));
    }

    function atualizarDadoMedico(campo, valor) {
        setFormulario((atual) => ({ ...atual, dados_medicos: {
            ...atual.dados_medicos, [campo]: valor,
            ...(campo === 'usa_medicamento' && valor !== 'true' ? { medicamentos_descricao: '' } : {}),
        } }));
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

    function normalizarTelefone(telefone) {
        return telefone.replace(/\D/g, '');
    }

    async function salvarAluno(status) {
        if (enviando.current) return;

        const nome = formulario.nome.trim();
        const telefone = normalizarTelefone(formulario.telefone);
        const responsaveis = formulario.responsaveis.map((responsavel) => ({
            nome: responsavel.nome.trim(), parentesco: responsavel.parentesco.trim(),
            telefone: normalizarTelefone(responsavel.telefone),
        })).filter((responsavel) => responsavel.nome || responsavel.parentesco || responsavel.telefone);

        if (!nome) {
            setSubmitError('Informe o nome do aluno.');
            return;
        }

        if (!formulario.turno || formulario.dias_frequencia.length === 0) {
            setSubmitError('Selecione o período e ao menos um dia de frequência.');
            return;
        }

        if ([telefone, ...responsaveis.map((responsavel) => responsavel.telefone)].some((valor) => valor && !/^\d{10,11}$/.test(valor))) {
            setSubmitError('Os telefones devem conter DDD e ter 10 ou 11 dígitos.');
            return;
        }
        if (responsaveis.some((responsavel) => responsavel.nome.length < 2 || responsavel.parentesco.length > 30)) {
            setSubmitError('Informe o nome de cada responsável e um parentesco de até 30 caracteres.');
            return;
        }
        const medicos = formulario.dados_medicos;
        if (medicos.usa_medicamento === 'true' && !medicos.medicamentos_descricao.trim()) {
            setSubmitError('Informe qual medicamento o aluno utiliza.');
            return;
        }
        const booleanoOpcional = (valor) => valor === '' ? null : valor === 'true';

        const turmaSelecionada = turmas.find((turma) => turma.id === Number(formulario.turma_id));
        if (status === 'ATIVO' && !turmaSelecionada) {
            setSubmitError('Selecione uma turma regular disponível para salvar o aluno como ativo.');
            return;
        }
        if (status === 'ATIVO' && turmaSelecionada.capacidade_maxima != null && turmaSelecionada.vagas_disponiveis === 0) {
            setSubmitError('A turma regular está sem vagas disponíveis.');
            return;
        }

        const dadosAluno = {
            nome,
            telefone: telefone || undefined,
            data_nascimento: formulario.data_nascimento || undefined,
            responsaveis,
            participa_procan: formulario.participa_procan,
            observacoes: formulario.observacoes.trim() || null,
            dados_medicos: {
                restricao_alimentar: medicos.restricao_alimentar.trim() || null,
                autorizado_atividade_fisica: booleanoOpcional(medicos.autorizado_atividade_fisica),
                usa_medicamento: booleanoOpcional(medicos.usa_medicamento),
                medicamentos_descricao: medicos.usa_medicamento === 'true' ? medicos.medicamentos_descricao.trim() : null,
                autorizacao_analgesico: medicos.autorizacao_analgesico || null,
            },
            turno: formulario.turno,
            dias_frequencia: formulario.dias_frequencia,
            participa_almoco: formulario.participa_almoco,
            status,
            ...(turmaSelecionada ? { turma_id: turmaSelecionada.id } : {}),
        };

        try {
            enviando.current = true;
            setIsSubmitting(true);
            setSubmitError('');
            const criado = await alunoService.criarAluno(dadosAluno);
            const alunoDaLista = {
                id: criado.id,
                nome: criado.nome,
                responsaveis: criado.responsaveis ?? [],
                participa_procan: criado.participa_procan,
                turno: criado.turno,
                dias_frequencia: criado.dias_frequencia,
                status: criado.status,
                turma_regular: turmaSelecionada
                    ? { id: turmaSelecionada.id, nome: turmaSelecionada.nome, turno: turmaSelecionada.turno }
                    : null,
            };

            setAlunos((atuais) => [...atuais, alunoDaLista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
            setIsModalOpen(false);
            resetarFormulario();
        } catch (err) {
            const mensagensValidacao = err.response?.data?.erros?.map((item) =>
                item.path?.[0] === 'responsaveis' && Number.isInteger(item.path[1]) ? `Responsável ${item.path[1] + 1}: ${item.message}` : item.message).join(' ');
            setSubmitError(err.response?.data?.erro || mensagensValidacao || 'Não foi possível salvar o aluno.');
        } finally {
            enviando.current = false;
            setIsSubmitting(false);
        }
    }

    function handleSubmit(event) {
        event.preventDefault();
        salvarAluno('ATIVO');
    }

    function salvarRascunho() {
        salvarAluno('RASCUNHO');
    }


    return (
        <div className="flex flex-col gap-lg">
            <div className="flex w-full flex-col gap-sm sm:flex-row sm:items-stretch">
                <FiltroEstado
                    count={contagemStatus.TODOS}
                    tipo="TODOS"
                    isSelecionado={statusSelecionado === 'TODOS'}
                    aria-pressed={statusSelecionado === 'TODOS'}
                    onClick={() => setStatusSelecionado('TODOS')}
                >
                    Todos
                </FiltroEstado>
                <FiltroEstado
                    count={contagemStatus.ATIVO}
                    tipo="ATIVO"
                    isSelecionado={statusSelecionado === 'ATIVO'}
                    aria-pressed={statusSelecionado === 'ATIVO'}
                    onClick={() => setStatusSelecionado('ATIVO')}
                >
                    Ativos
                </FiltroEstado>
                <FiltroEstado
                    count={contagemStatus.INATIVO}
                    tipo="INATIVO"
                    isSelecionado={statusSelecionado === 'INATIVO'}
                    aria-pressed={statusSelecionado === 'INATIVO'}
                    onClick={() => setStatusSelecionado('INATIVO')}
                >
                    Inativos
                </FiltroEstado>
                <FiltroEstado
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
                <Input
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
                    secondaryText="Salvar rascunho"
                    onSecondaryAction={salvarRascunho}
                    confirmFormId="form-cadastro-aluno"
                    onConfirm={handleSubmit}
                    isConfirmLoading={isSubmitting}>
                    <form id="form-cadastro-aluno" onSubmit={handleSubmit}>
                        <fieldset disabled={isSubmitting} className="min-w-0">
                        <div className="mb-md border-b border-gray-200 pb-sm">
                            <h3 className="text-sm font-semibold text-text-main">Dados pessoais</h3>
                        </div>
                        <Input
                            id="nome-aluno"
                            name="nome"
                            type="text"
                            label="Nome Completo"
                            placeholder="Ex: Lucas Andrade"
                            value={formulario.nome}
                            onChange={(event) => atualizarCampo('nome', event.target.value)}
                            required
                        />
                        <div className="flex flex-row gap-md">
                            <Input
                                id="telefone-aluno"
                                name="telefone"
                                type="tel"
                                label="Telefone"
                                placeholder="(11) 1 1111-1111"
                                value={formulario.telefone}
                                onChange={(event) => atualizarCampo('telefone', event.target.value)}
                            />
                            <Input
                                id="data-nascimento-aluno"
                                name="data_nascimento"
                                type="date"
                                label="Data de nascimento"
                                value={formulario.data_nascimento}
                                onChange={(event) => atualizarCampo('data_nascimento', event.target.value)}
                            />
                        </div>
                        <Toggle label="Procan" name="participa_procan" checked={formulario.participa_procan}
                            onChange={(valor) => atualizarCampo('participa_procan', valor)} />
                        <div className="mb-md">
                            <label htmlFor="observacoes-aluno" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600">Observações</label>
                            <textarea id="observacoes-aluno" name="observacoes" rows={3}
                                placeholder="Informações importantes sobre o aluno, sua rotina ou comportamento"
                                value={formulario.observacoes} onChange={(event) => atualizarCampo('observacoes', event.target.value)}
                                className="w-full resize-y rounded-sm border border-slate-200 bg-bg-surface p-sm text-text-main placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-secondary" />
                        </div>
                        <div className="mb-md flex items-center justify-between gap-sm border-b border-gray-200 pb-sm">
                            <h3 className="text-sm font-semibold text-text-main">Responsáveis <span className="font-normal text-text-muted">(opcional)</span></h3>
                            <button type="button" onClick={adicionarResponsavel}
                                className="rounded-sm border border-slate-200 px-sm py-xs text-xs font-semibold text-text-main hover:bg-bg-main">+ Adicionar responsável</button>
                        </div>
                        {formulario.responsaveis.map((responsavel, indice) => (
                            <div key={responsavel.chave} className="mb-md flex items-start gap-sm rounded-md border border-slate-200 bg-bg-main p-sm">
                                <span className="mt-7 flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-secondary">{indice + 1}</span>
                                <div className="grid min-w-0 flex-1 grid-cols-1 gap-sm sm:grid-cols-3">
                                    <Input id={`responsavel-${responsavel.chave}-nome`} name={`responsaveis.${responsavel.chave}.nome`}
                                        label={`Nome do responsável`} placeholder="Ex: Roberto Andrade"
                                        value={responsavel.nome} onChange={(event) => atualizarResponsavel(responsavel.chave, 'nome', event.target.value)} />
                                    <Input id={`responsavel-${responsavel.chave}-parentesco`} name={`responsaveis.${responsavel.chave}.parentesco`}
                                        label="Parentesco" placeholder="Ex: Mãe" maxLength={30}
                                        value={responsavel.parentesco} onChange={(event) => atualizarResponsavel(responsavel.chave, 'parentesco', event.target.value)} />
                                    <Input id={`responsavel-${responsavel.chave}-telefone`} name={`responsaveis.${responsavel.chave}.telefone`}
                                        label="Telefone" type="tel" placeholder="(11) 99999-9999"
                                        value={responsavel.telefone} onChange={(event) => atualizarResponsavel(responsavel.chave, 'telefone', event.target.value)} />
                                </div>
                                <button type="button" aria-label={`Remover responsável ${indice + 1}`} onClick={() => removerResponsavel(responsavel.chave)}
                                    className="mt-7 rounded-sm border border-slate-200 px-2 py-1 text-xs text-text-muted hover:bg-bg-surface">×</button>
                            </div>
                        ))}
                        <div className="mb-md border-b border-gray-200 pb-sm">
                            <h3 className="text-sm font-semibold text-text-main">Saúde e cuidados <span className="font-normal text-text-muted">(opcional)</span></h3>
                        </div>
                        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
                            <Input id="restricao-alimentar" name="restricao_alimentar" label="Restrição alimentar" placeholder="Ex: intolerância à lactose"
                                value={formulario.dados_medicos.restricao_alimentar} onChange={(event) => atualizarDadoMedico('restricao_alimentar', event.target.value)} />
                            <Select id="atividade-fisica" name="autorizado_atividade_fisica" label="Autorização para atividade física" placeholder="— Não informado —"
                                value={formulario.dados_medicos.autorizado_atividade_fisica} onChange={(event) => atualizarDadoMedico('autorizado_atividade_fisica', event.target.value)}
                                options={[{ value: 'true', label: 'Autorizado' }, { value: 'false', label: 'Não autorizado' }]} />
                            <Select id="usa-medicamento" name="usa_medicamento" label="Uso de medicamento" placeholder="— Não informado —"
                                value={formulario.dados_medicos.usa_medicamento} onChange={(event) => atualizarDadoMedico('usa_medicamento', event.target.value)}
                                options={[{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }]} />
                            <Select id="autorizacao-analgesico" name="autorizacao_analgesico" label="Em caso de dor" placeholder="— Não informado —"
                                value={formulario.dados_medicos.autorizacao_analgesico} onChange={(event) => atualizarDadoMedico('autorizacao_analgesico', event.target.value)}
                                options={[
                                    { value: 'NENHUM', label: 'Nenhum' }, { value: 'PARACETAMOL', label: 'Paracetamol' },
                                    { value: 'DIPIRONA', label: 'Dipirona' }, { value: 'AMBOS', label: 'Ambos' },
                                ]} />
                        </div>
                        {formulario.dados_medicos.usa_medicamento === 'true' && (
                            <Input id="medicamentos-descricao" name="medicamentos_descricao" label="Qual medicamento?" placeholder="Nome e dosagem, se houver" required
                                value={formulario.dados_medicos.medicamentos_descricao} onChange={(event) => atualizarDadoMedico('medicamentos_descricao', event.target.value)} />
                        )}
                        <div className="border-gray-200 border-b w-full py-sm mb-md">
                            <h3 className="font-semibold text-[14px] text-text-main px-1">Frequência</h3>
                        </div>
                        <SelecaoOpcao
                            label="Período"
                            name="turno"
                            required
                            value={formulario.turno}
                            onChange={(valor) => atualizarCampo('turno', valor)}
                            options={[
                                { value: 'MANHA', title: 'Manhã' },
                                { value: 'TARDE', title: 'Tarde' },
                            ]}
                        />
                        <SelecaoDiasSemana
                            label="Dias de frequência"
                            required
                            value={formulario.dias_frequencia}
                            onChange={(dias) => atualizarCampo('dias_frequencia', dias)}
                            options={[
                                { value: 1, label: 'Seg' },
                                { value: 2, label: 'Ter' },
                                { value: 3, label: 'Qua' },
                                { value: 4, label: 'Qui' },
                                { value: 5, label: 'Sex' },
                                { value: 'TODOS', label: 'Todos' },
                            ]}
                        />
                        <div className="flex flex-col gap-md sm:flex-row sm:items-start sm:justify-between">
                            <Toggle
                                label="Participa do almoço?"
                                name="participa_almoco"
                                checked={formulario.participa_almoco}
                                onChange={(valor) => atualizarCampo('participa_almoco', valor)}
                            />
                            <Select
                                label="Turma regular"
                                name="turma_id"
                                value={formulario.turma_id}
                                onChange={(event) => atualizarCampo('turma_id', event.target.value)}
                                required
                                className="ml-30"
                                disabled={!formulario.turno}
                                options={turmas
                                    .filter((turma) => turma.turno === formulario.turno)
                                    .map((turma) => ({
                                        value: turma.id,
                                        label: `${turma.nome} - ${formatarTurno(turma.turno)}${turma.capacidade_maxima == null ? ' — Sem limite' : turma.vagas_disponiveis === 0 ? ' — Lotada: rascunho não reserva vaga' : ''}`,
                                    }))}
                            />
                        </div>
                        {submitError && (
                            <p role="alert" className="mb-md rounded-sm bg-red-50 p-sm text-sm text-red-700">
                                {submitError}
                            </p>
                        )}
                        <div className="w-full rounded-md border border-tertiary bg-tertiary/10 p-md text-[12px] text-[#92400E]">
                            <h3 className="text-[14px] font-semibold">Salvar como rascunho</h3>
                            <p>Informe nome, período e dias de frequência. A turma regular é opcional para o rascunho e não reserva vaga.</p>
                        </div>
                        </fieldset>
                    </form>
                </Modal>
            </div>
            <TabelaAlunos alunos={alunosFiltrados} />
        </div>
    )
}
