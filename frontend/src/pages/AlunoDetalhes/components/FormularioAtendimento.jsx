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

const formularioInicial = {
    modalidade: '', profissional_id: '', data_inicio: '', hora_inicio: '', duracao_minutos: '',
    tipo_recorrencia: 'SEMANAL', frequencia: '1', dias_semana: [], data_termino: '',
};

const erroInicioPassado = 'Não é possível agendar um atendimento em uma data ou horário no passado.';
const erroInicioMensal = 'A data de início da recorrência mensal deve ser de segunda a sexta-feira.';

export function FormularioAtendimento({ atendimento, idAluno, onClose, onSuccess }) {
    const editando = Boolean(atendimento);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRecorrente, setIsRecorrente] = useState(atendimento ? atendimento.tipo_recorrencia !== 'EVENTUAL' : false);
    const [formulario, setFormulario] = useState(() => atendimento ? {
        modalidade: atendimento.modalidade, profissional_id: String(atendimento.profissional_id),
        data_inicio: atendimento.data_inicio.slice(0, 10), hora_inicio: atendimento.hora_inicio.slice(11, 16),
        duracao_minutos: String(atendimento.duracao_minutos), tipo_recorrencia: atendimento.tipo_recorrencia,
        frequencia: String(atendimento.frequencia ?? 1), dias_semana: atendimento.dias_semana ?? [], data_termino: atendimento.data_termino?.slice(0, 10) ?? ''
    } : formularioInicial);
    const [profissionais, setProfissionais] = useState([]);
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
                setErroProfissionais('');
                const dados = await profissionaisService.listarTodos(controller.signal);
                if (!controller.signal.aborted) setProfissionais(dados.filter((profissional) => profissional.status_geral === 'ATIVO' || profissional.id === atendimento?.profissional_id));
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

    function fecharModal() { if (!enviando.current) onClose(); }

    async function confirmarModal(event) {
        event.preventDefault();
        if (enviando.current || carregandoProfissionais || erroProfissionais) return;
        setSubmitError('');
        setConflitos([]);

        const aluno_id = Number(idAluno);
        const profissional_id = Number(formulario.profissional_id);
        const duracao_minutos = Number(formulario.duracao_minutos);
        const frequencia = Number(formulario.frequencia);
        if (!Number.isInteger(aluno_id) || aluno_id < 1) {
            setSubmitError('Aluno não identificado.');
            return;
        }
        if (!formulario.modalidade || !profissionais.some((profissional) => profissional.id === profissional_id)) {
            setSubmitError('Selecione a modalidade e um profissional cadastrado.');
            return;
        }
        if (!formulario.data_inicio || !formulario.hora_inicio || !Number.isInteger(duracao_minutos) || duracao_minutos < 1) {
            setSubmitError('Informe a data, o horário e uma duração válida.');
            return;
        }
        const instanteEnvio = new Date();
        if ((!editando || !isRecorrente) && `${formulario.data_inicio}T${formulario.hora_inicio}:00.000` < formatarDataHoraInstituicao(instanteEnvio)) {
            setAgora(instanteEnvio);
            return;
        }
        if (inicioMensalNoFimDeSemana) return;
        if (isRecorrente && (!Number.isInteger(frequencia) || frequencia < 1 || !formulario.data_termino)) {
            setSubmitError('Informe a frequência e a data de término da recorrência.');
            return;
        }
        if (isRecorrente && formulario.data_termino < formulario.data_inicio) {
            setSubmitError('A data de término não pode ser anterior à data de início.');
            return;
        }
        if (isRecorrente && formulario.tipo_recorrencia === 'SEMANAL' && formulario.dias_semana.length === 0) {
            setSubmitError('Selecione ao menos um dia da semana.');
            return;
        }

        const dadosAtendimento = {
            aluno_id, profissional_id, modalidade: formulario.modalidade,
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
            onSuccess();
        } catch (err) {
            const mensagens = err.response?.data?.erros?.map((erro) => erro.message).join(' ');
            setSubmitError(mensagens || err.response?.data?.erro || 'Não foi possível agendar o atendimento.');
            setConflitos(Array.isArray(err.response?.data?.conflitos) ? err.response.data.conflitos : []);
        } finally {
            enviando.current = false;
            setIsSubmitting(false);
        }
    }

    return (
        <Modal isOpen
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
            isConfirmDisabled={Boolean(erroInicio) || carregandoProfissionais || Boolean(erroProfissionais) || profissionais.length === 0}>

            <form id="form-criar-atendimento" onSubmit={confirmarModal} noValidate>
                <fieldset disabled={isSubmitting} className="min-w-0">
                    {bloqueado && <p className="mb-md rounded-sm bg-amber-50 p-sm text-sm text-amber-800">Há sessões já iniciadas. Modalidade, início e tipo de recorrência estão bloqueados. As demais alterações atingem somente sessões futuras.</p>}
                    <div className="flex flex-row justify-between gap-md">
                        <Select
                            label="Modalidade"
                            name="modalidade" disabled={bloqueado}
                            value={formulario.modalidade}
                            onChange={(event) => atualizarCampo('modalidade', event.target.value)}
                            placeholder="Selecione uma modalidade"
                            required
                            options={[
                                { value: 'Psicologia', label: 'Psicologia' },
                                { value: 'Fonoaudiologia', label: 'Fonoaudiologia' },
                                ...(atendimento?.modalidade && !['Psicologia', 'Fonoaudiologia'].includes(atendimento.modalidade) ? [{ value: atendimento.modalidade, label: atendimento.modalidade }] : []),
                            ]}
                        />

                        <Select
                            label="Profissional"
                            name="profissional_id"
                            value={formulario.profissional_id}
                            onChange={(event) => atualizarCampo('profissional_id', event.target.value)}
                            disabled={carregandoProfissionais || Boolean(erroProfissionais) || profissionais.length === 0}
                            placeholder={carregandoProfissionais ? 'Carregando profissionais...' : 'Selecione um profissional'}
                            required
                            options={profissionais.map((profissional) => ({
                                value: profissional.id,
                                label: `${profissional.nome}${profissional.funcao ? ` · ${profissional.funcao}` : ''}`,
                            }))}
                        />
                    </div>
                    {carregandoProfissionais && <p role="status" className="mb-md text-sm text-text-muted">Carregando profissionais...</p>}
                    {erroProfissionais && (
                        <div className="mb-md text-sm text-red-700" role="alert">
                            <p>{erroProfissionais}</p>
                            <button type="button" className="mt-xs underline" onClick={() => setTentativaProfissionais((valor) => valor + 1)}>
                                Tentar novamente
                            </button>
                        </div>
                    )}
                    {!carregandoProfissionais && !erroProfissionais && profissionais.length === 0 && (
                        <p role="status" className="mb-md text-sm text-text-muted">Nenhum profissional ativo cadastrado.</p>
                    )}
                    <div className="flex flex-row justify-between gap-md">
                        <Input
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

                        <Input
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

                        <Select
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

                    <Toggle disabled={editando}
                        label="Atendimento Recorrente"
                        name="recorrente"
                        checked={isRecorrente}
                        onChange={alterarRecorrencia}
                    />
                    {isRecorrente && (
                        <div className="flex flex-col  bg-bg-main p-md rounded-md border border-gray-300">
                            <div className="flex flex-row justify-between gap-md">
                                <div className="w-30">
                                    <Input
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
                                <SelecaoOpcao
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
                                {formulario.tipo_recorrencia === 'SEMANAL' && <SelecaoDiasSemana
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
                                    <Input
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
                    {(submitError || erroInicio) && (
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
    );
}
