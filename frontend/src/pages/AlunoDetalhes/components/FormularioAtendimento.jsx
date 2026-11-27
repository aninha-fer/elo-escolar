import { ConteudoBotao } from '../../../components/ConteudoBotao';
import { useToast } from '../../../contexts/ToastContext';
import { Input } from "../../../components/Input";
import { Modal } from "../../../components/Modal";
import { useEffect, useRef, useState } from "react";
import { Select } from "../../../components/Select";
import { SelecaoDiasSemana } from "../../../components/SelecaoDiasSemana";
import { SelecaoOpcao } from "../../../components/SelecaoOpcao";
import { Toggle } from "../../../components/Toggle";
import { atendimentosService } from "../../../services/atendimentosService";
import { profissionaisService } from "../../../services/profissionaisService";
import { formatarDataHoraInstituicao, formatarMensagemConflito } from "../../../utils/formatters";
import { SaveIcon } from "../../../components/icons/SaveIcon";
import { SelectComCadastro } from "../../../components/SelectComCadastro";
import { FormularioProfissional } from "../../Profissionais/FormularioProfissional";
import { modalidadesService } from "../../../services/modalidadesService";

const formularioInicial = {
    modalidade_id: '', profissional_id: '', data_inicio: '', hora_inicio: '', duracao_minutos: '',
    tipo_recorrencia: 'SEMANAL', frequencia: '1', dias_semana: [], data_termino: '',
};

const erroInicioPassado = 'Não é possível agendar um atendimento em uma data ou horário no passado.';
const erroInicioMensal = 'A data de início da recorrência mensal deve ser de segunda a sexta-feira.';

export function FormularioAtendimento({ atendimento, idAluno, onClose, onSuccess }) {
    const { notificar } = useToast();
    const editando = Boolean(atendimento);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRecorrente, setIsRecorrente] = useState(atendimento ? atendimento.tipo_recorrencia !== 'EVENTUAL' : false);
    const [formulario, setFormulario] = useState(() => atendimento ? {
        modalidade_id: String(atendimento.modalidade_id), profissional_id: String(atendimento.profissional_id),
        data_inicio: atendimento.data_inicio.slice(0, 10), hora_inicio: atendimento.hora_inicio.slice(11, 16),
        duracao_minutos: String(atendimento.duracao_minutos), tipo_recorrencia: atendimento.tipo_recorrencia,
        frequencia: String(atendimento.frequencia ?? 1), dias_semana: atendimento.dias_semana ?? [], data_termino: atendimento.data_termino?.slice(0, 10) ?? ''
    } : formularioInicial);
    const [profissionais, setProfissionais] = useState([]);
    const [novoProfissional, setNovoProfissional] = useState(false);
    const [modalidades, setModalidades] = useState([]);
    const [carregandoModalidades, setCarregandoModalidades] = useState(true);
    const [erroModalidades, setErroModalidades] = useState('');
    const [tentativaModalidades, setTentativaModalidades] = useState(0);
    const [carregandoProfissionais, setCarregandoProfissionais] = useState(false);
    const [erroProfissionais, setErroProfissionais] = useState('');
    const [tentativaProfissionais, setTentativaProfissionais] = useState(0);
    const [submitError, setSubmitError] = useState('');
    const [conflitos, setConflitos] = useState([]);
    const [agora, setAgora] = useState(() => new Date());
    const enviando = useRef(false);
    const bloqueado = editando && (atendimento.possui_sessoes_iniciadas || Boolean(atendimento.inicio_primeira_sessao && atendimento.inicio_primeira_sessao <= formatarDataHoraInstituicao(agora)));
    const inicioMinimo = formatarDataHoraInstituicao(new Date(Math.ceil(agora.getTime() / 60000) * 60000));
    const dataMinima = inicioMinimo.slice(0, 10);
    const inicioNoPassado = Boolean((!editando || !isRecorrente) && formulario.data_inicio && formulario.hora_inicio &&
        `${formulario.data_inicio}T${formulario.hora_inicio}:00.000` < formatarDataHoraInstituicao(agora));
    const recorrenciaMensal = isRecorrente && formulario.tipo_recorrencia === 'MENSAL';
    const inicioMensalNoFimDeSemana = Boolean(recorrenciaMensal && formulario.data_inicio &&
        [0, 6].includes(new Date(`${formulario.data_inicio}T00:00:00.000Z`).getUTCDay()));
    const erroInicio = inicioNoPassado ? erroInicioPassado : inicioMensalNoFimDeSemana ? erroInicioMensal : '';

    useEffect(() => {
        const timer = setInterval(() => setAgora(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        async function carregarProfissionais() {
            try {
                setCarregandoProfissionais(true);
                const dados = await profissionaisService.listarTodos(controller.signal);
                if (!controller.signal.aborted) { setErroProfissionais(''); setProfissionais(dados.filter((profissional) => profissional.status_geral === 'ATIVO' || profissional.id === atendimento?.profissional_id)); }
            } catch (err) {
                if (controller.signal.aborted || err.code === 'ERR_CANCELED') return;
                setErroProfissionais(err.response?.data?.erro || 'Não foi possível carregar os profissionais.');
            } finally {
                if (!controller.signal.aborted) setCarregandoProfissionais(false);
            }
        }
        carregarProfissionais();
        return () => controller.abort();
    }, [tentativaProfissionais, atendimento?.profissional_id]);

    useEffect(() => {
        const controller = new AbortController();
        async function carregar() {
            setCarregandoModalidades(true);
            try {
                const dados = await modalidadesService.listarTodos(controller.signal);
                if (!controller.signal.aborted) { setModalidades(dados); setErroModalidades(''); }
            } catch (error) {
                if (!controller.signal.aborted && error.code !== 'ERR_CANCELED') setErroModalidades(error.response?.data?.erro || 'Não foi possível carregar as modalidades.');
            } finally { if (!controller.signal.aborted) setCarregandoModalidades(false); }
        }
        carregar();
        return () => controller.abort();
    }, [tentativaModalidades]);

    function fecharProfissional() {
        setNovoProfissional(false);
        requestAnimationFrame(() => document.getElementById('atendimento-profissional')?.focus());
    }

    function profissionalCriado(criado) {
        setProfissionais((atuais) => [...atuais.filter((item) => item.id !== criado.id), criado].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.id - b.id));
        setFormulario((atual) => ({ ...atual, profissional_id: String(criado.id) }));
        notificar('Profissional cadastrado com sucesso.', 'sucesso');
        fecharProfissional();
    }


    function atualizarCampo(campo, valor) {
        if (campo === 'tipo_recorrencia' && valor === formulario.tipo_recorrencia) return;
        setFormulario((atual) => ({
            ...atual, [campo]: valor,
            ...(campo === 'tipo_recorrencia' ? { dias_semana: [], frequencia: '' } : {}),
        }));
    }

    function alterarRecorrencia(recorrente) {
        setIsRecorrente(recorrente);
        if (!recorrente) {
            setFormulario((atual) => ({ ...atual, tipo_recorrencia: 'SEMANAL', frequencia: '1', dias_semana: [], data_termino: '' }));
        }
    }

    function fecharModal() { if (!enviando.current && !novoProfissional) onClose(); }

    async function confirmarModal(event) {
        event.preventDefault();
        if (enviando.current || novoProfissional || carregandoProfissionais || erroProfissionais || carregandoModalidades || erroModalidades) return;
        setSubmitError('');
        setConflitos([]);

        const aluno_id = Number(idAluno);
        const profissional_id = Number(formulario.profissional_id);
        const duracao_minutos = Number(formulario.duracao_minutos);
        const frequencia = Number(formulario.frequencia);
        if (!Number.isInteger(aluno_id) || aluno_id < 1) {
            notificar('Aluno não identificado.');
            return;
        }
        if (!modalidades.some((item) => item.id === Number(formulario.modalidade_id)) || !profissionais.some((profissional) => profissional.id === profissional_id)) {
            notificar('Selecione a modalidade e um profissional cadastrado.');
            return;
        }
        if (!formulario.data_inicio || !formulario.hora_inicio || !Number.isInteger(duracao_minutos) || duracao_minutos < 1) {
            notificar('Informe a data, o horário e uma duração válida.');
            return;
        }
        const instanteEnvio = new Date();
        if ((!editando || !isRecorrente) && `${formulario.data_inicio}T${formulario.hora_inicio}:00.000` < formatarDataHoraInstituicao(instanteEnvio)) {
            setAgora(instanteEnvio);
            return;
        }
        if (inicioMensalNoFimDeSemana) return;
        if (isRecorrente && (!Number.isInteger(frequencia) || frequencia < 1 || !formulario.data_termino)) {
            notificar('Informe a frequência e a data de término da recorrência.');
            return;
        }
        if (isRecorrente && formulario.data_termino < formulario.data_inicio) {
            notificar('A data de término não pode ser anterior à data de início.');
            return;
        }
        if (isRecorrente && formulario.tipo_recorrencia === 'SEMANAL' && formulario.dias_semana.length === 0) {
            notificar('Selecione ao menos um dia da semana.');
            return;
        }

        const dadosAtendimento = {
            aluno_id, profissional_id, modalidade_id: Number(formulario.modalidade_id),
            data_inicio: formulario.data_inicio, hora_inicio: formulario.hora_inicio, duracao_minutos,
            tipo_recorrencia: isRecorrente ? formulario.tipo_recorrencia : 'EVENTUAL',
            dias_semana: isRecorrente && formulario.tipo_recorrencia === 'SEMANAL' ? formulario.dias_semana : [],
            ...(isRecorrente ? { frequencia, data_termino: formulario.data_termino } : {}),
        };

        try {
            enviando.current = true;
            setIsSubmitting(true);
            if (editando) {
                const original = { ...atendimento, data_inicio: atendimento.data_inicio.slice(0, 10), hora_inicio: atendimento.hora_inicio.slice(11, 16), data_termino: atendimento.data_termino?.slice(0, 10) };
                const alterados = Object.fromEntries(Object.entries(dadosAtendimento).filter(([campo, valor]) => campo !== 'aluno_id' && (isRecorrente || campo !== 'dias_semana') &&
                    JSON.stringify(campo === 'dias_semana' ? [...valor].sort() : valor) !== JSON.stringify(campo === 'dias_semana' ? [...original[campo]].sort() : original[campo])));
                if (!Object.keys(alterados).length) { onClose(); return; }
                await atendimentosService.editar(idAluno, atendimento.id, alterados);
            } else await atendimentosService.criar(dadosAtendimento);
            notificar(editando ? 'Atendimento atualizado com sucesso.' : 'Atendimento cadastrado com sucesso.', 'sucesso');
            onSuccess();
        } catch (err) {
            const mensagens = err.response?.data?.erros?.map((erro) => erro.message).join(' ');
            const mensagemErro = mensagens || err.response?.data?.erro || 'Não foi possível agendar o atendimento.';
            if (err.response?.data?.conflitos?.length) setSubmitError(mensagemErro);
            else notificar(mensagemErro);
            setConflitos(Array.isArray(err.response?.data?.conflitos) ? err.response.data.conflitos : []);
        } finally {
            enviando.current = false;
            setIsSubmitting(false);
        }
    }

    return <>
        <div inert={novoProfissional} aria-hidden={novoProfissional ? true : undefined}>
        <Modal testId="atendimento-formulario" isOpen
            onClose={fecharModal}
            title={editando ? 'Editar Atendimento Clínico' : 'Novo Atendimento Clínico'}
            subtitle={editando ? 'Altere os dados do atendimento. Sessões já iniciadas serão preservadas.' : 'Agende um novo atendimento clínico para este aluno.'}
            confirmText={<span className="inline-flex items-center gap-sm">
                <SaveIcon />
                {editando ? 'Salvar alterações' : 'Agendar'}
            </span>
            }
            cancelText="Cancelar"
            confirmFormId="form-criar-atendimento"
            onConfirm={confirmarModal}
            isConfirmLoading={isSubmitting}
            isConfirmDisabled={Boolean(erroInicio) || carregandoProfissionais || Boolean(erroProfissionais) || profissionais.length === 0 || carregandoModalidades || Boolean(erroModalidades) || modalidades.length === 0}>

            <form id="form-criar-atendimento" onSubmit={confirmarModal} noValidate>
                <fieldset disabled={isSubmitting} className="min-w-0">
                    {bloqueado && <p className="mb-md rounded-sm bg-amber-50 p-sm text-sm text-amber-800">Há sessões já iniciadas. Modalidade, início e tipo de recorrência estão bloqueados. As demais alterações atingem somente sessões futuras.</p>}
                    <div className="flex flex-row justify-between gap-md">
                        <Select data-testid="atendimento-formulario-modalidade"
                            label="Modalidade"
                            name="modalidade_id" disabled={bloqueado || carregandoModalidades || Boolean(erroModalidades)}
                            loading={carregandoModalidades} loadingLabel="Carregando modalidades..."
                            value={formulario.modalidade_id}
                            onChange={(event) => atualizarCampo('modalidade_id', event.target.value)}
                            placeholder="Selecione uma modalidade"
                            required
                            options={modalidades.map((item) => ({ value: item.id, label: item.nome }))}
                        />

                        <SelectComCadastro testId="atendimento-formulario-profissional" id="atendimento-profissional"
                            label="Profissional"
                            value={formulario.profissional_id}
                            onChange={(valor) => atualizarCampo('profissional_id', valor)}
                            onCadastrar={() => setNovoProfissional(true)} textoCadastro="Adicionar profissional"
                            disabled={carregandoProfissionais || Boolean(erroProfissionais)}
                            loading={carregandoProfissionais} placeholder="Selecione um profissional"
                            required
                            options={profissionais.map((profissional) => ({
                                value: profissional.id,
                                label: `${profissional.nome}${profissional.funcao ? ` · ${profissional.funcao}` : ''}`,
                            }))}
                        />
                    </div>
                    {erroModalidades && <div role="alert" className="mb-md text-sm text-danger"><p>{erroModalidades}</p><button type="button" data-testid="atendimento-modalidades-tentar" disabled={carregandoModalidades} onClick={() => setTentativaModalidades((valor) => valor + 1)}><ConteudoBotao carregando={carregandoModalidades}>Tentar novamente</ConteudoBotao></button></div>}
                    {!carregandoModalidades && !erroModalidades && !modalidades.length && <p className="mb-md text-sm text-text-muted">Cadastre uma modalidade nas configurações para agendar um atendimento.</p>}
                    {erroProfissionais && (
                        <div className="mb-md text-sm text-red-700" role="alert">
                            <p>{erroProfissionais}</p>
                            <button data-testid="atendimento-formulario-profissionais-tentar-novamente" type="button" className="mt-xs underline" disabled={carregandoProfissionais} onClick={() => setTentativaProfissionais((valor) => valor + 1)}><ConteudoBotao carregando={carregandoProfissionais}>Tentar novamente</ConteudoBotao></button>
                        </div>
                    )}
                    {!carregandoProfissionais && !erroProfissionais && profissionais.length === 0 && (
                        <p role="status" className="mb-md text-sm text-text-muted">Nenhum profissional ativo cadastrado.</p>
                    )}
                    <div className="flex flex-row justify-between gap-md">
                        <Input data-testid="atendimento-formulario-data-inicio"
                            label="Data de Início"
                            placeholder="Selecione a data de início"
                            id="data-inicio"
                            name="data_inicio" disabled={bloqueado}
                            min={dataMinima}
                            value={formulario.data_inicio}
                            onChange={(event) => atualizarCampo('data_inicio', event.target.value)}
                            type="date"
                            required
                        />

                        <Input data-testid="atendimento-formulario-hora-inicio"
                            label="Hora de Início"
                            placeholder="Selecione a hora de início"
                            id="hora-inicio"
                            name="hora_inicio"
                            min={formulario.data_inicio === dataMinima ? inicioMinimo.slice(11, 16) : undefined}
                            step="60"
                            value={formulario.hora_inicio}
                            onChange={(event) => atualizarCampo('hora_inicio', event.target.value)}
                            type="time"
                            required
                        />

                        <Select data-testid="atendimento-formulario-duracao"
                            label="Duração (min)"
                            name="duracao_minutos"
                            value={formulario.duracao_minutos}
                            onChange={(event) => atualizarCampo('duracao_minutos', event.target.value)}
                            placeholder="Selecione a duração"
                            // className="w-60"
                            required
                            options={[
                                { value: '30', label: '30 minutos' },
                                { value: '45', label: '45 minutos' },
                                { value: '50', label: '50 minutos' },
                                { value: '60', label: '60 minutos' },
                            ]}
                        />
                    </div>

                    <Toggle testId="atendimento-formulario-recorrente" disabled={editando}
                        id="atendimento-formulario-recorrente"
                        label="Atendimento Recorrente"
                        name="recorrente"
                        checked={isRecorrente}
                        onChange={alterarRecorrencia}
                    />
                    {isRecorrente && (
                        <div className="flex flex-col  bg-bg-main p-md rounded-md border border-gray-300">
                            <div className="flex flex-row justify-between gap-md">
                                <div className="w-30">
                                    <Input data-testid="atendimento-formulario-frequencia"
                                        label="A cada..."
                                        placeholder="Ex: 1, 2, 4..."
                                        id="frequencia"
                                        name="frequencia"
                                        value={formulario.frequencia}
                                        onChange={(event) => atualizarCampo('frequencia', event.target.value)}
                                        type="number"
                                        min="1"
                                        step="1"
                                        required
                                    />
                                </div>
                                <SelecaoOpcao testId="atendimento-formulario-tipo-recorrencia"
                                    label="Tipo de Recorrência"
                                    name="tipo_recorrencia" disabled={bloqueado}
                                    value={formulario.tipo_recorrencia}
                                    onChange={(valor) => atualizarCampo('tipo_recorrencia', valor)}
                                    required
                                    options={[
                                        { value: 'SEMANAL', label: 'Semanal' },
                                        { value: 'MENSAL', label: 'Mensal' },
                                    ]}
                                />
                            </div>
                            {recorrenciaMensal && (
                                <p className="mb-md text-sm text-text-muted">
                                    A data inicial deve ser de segunda a sexta-feira. Nas próximas sessões, sábados e domingos serão antecipados para a sexta-feira anterior.
                                </p>
                            )}
                            <div className="flex flex-row justify-between gap-md items-center">
                                {formulario.tipo_recorrencia === 'SEMANAL' && <SelecaoDiasSemana testId="atendimento-formulario-dias-semana"
                                    label="Dias da Semana"
                                    name="dias_semana"
                                    value={formulario.dias_semana}
                                    onChange={(dias) => atualizarCampo('dias_semana', dias)}
                                    required
                                    options={[
                                        { value: 1, label: 'Seg' },
                                        { value: 2, label: 'Ter' },
                                        { value: 3, label: 'Qua' },
                                        { value: 4, label: 'Qui' },
                                        { value: 5, label: 'Sex' },
                                        { value: 'TODOS', label: 'Todos' },
                                    ]} />}
                                <div className="w-65">
                                    <Input data-testid="atendimento-formulario-data-termino"
                                        label="Data de Término"
                                        placeholder="Selecione a data de término"
                                        id="data-termino"
                                        name="data_termino"
                                        value={formulario.data_termino}
                                        onChange={(event) => atualizarCampo('data_termino', event.target.value)}
                                        min={formulario.data_inicio > dataMinima ? formulario.data_inicio : dataMinima}
                                        type="date"
                                        required
                                    />
                                </div>

                            </div>
                        </div>
                    )}
                    {(conflitos.length > 0 || erroInicio) && (
                        <div role="alert" className="mt-md rounded-sm border border-red-200 bg-red-50 p-md text-sm text-red-700">
                            <p>{erroInicio || submitError}</p>
                            {!erroInicio && conflitos.length > 0 && (
                                <ul className="mt-sm list-disc space-y-xs pl-md">
                                    {conflitos.map((conflito, indice) => <li key={indice}>{formatarMensagemConflito(conflito)}</li>)}
                                </ul>
                            )}
                        </div>
                    )}
                </fieldset>
            </form>
        </Modal>
        </div>
        {novoProfissional && <FormularioProfissional trapFocus onClose={fecharProfissional} onCriado={profissionalCriado} />}
    </>;
}
