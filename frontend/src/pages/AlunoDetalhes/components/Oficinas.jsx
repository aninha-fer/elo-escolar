import { useState } from "react";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import { OficinaItem } from "../../../components/OficinaItem";
import { matriculasService } from "../../../services/matriculasService";
import { ConflitosOficinas } from "../../../components/ConflitosOficinas";

const DIAS_SEMANA = {
    1: 'Segunda',
    2: 'Terça',
    3: 'Quarta',
    4: 'Quinta',
    5: 'Sexta',
    6: 'Sábado',
    7: 'Domingo',
};

function agruparOficinas(oficinas) {
    return Object.values(
        oficinas.reduce((grupos, oficina) => {
            const chave = oficina.matricula_id ?? oficina.turma_id ?? oficina.turma_nome;
            const grupoAtual = grupos[chave] ?? {
                ...oficina,
                dias: [],
            };

            if (oficina.dia_semana && !grupoAtual.dias.some((dia) => dia.numero === oficina.dia_semana)) {
                grupoAtual.dias.push({
                    numero: oficina.dia_semana,
                    nome: DIAS_SEMANA[oficina.dia_semana] ?? 'Dia não informado',
                });
            }

            grupos[chave] = grupoAtual;
            return grupos;
        }, {}),
    ).sort((primeira, segunda) => primeira.turma_nome.localeCompare(segunda.turma_nome));
}

function normalizarTurmas(turmas) {
    return (Array.isArray(turmas) ? turmas : []).flatMap((turma) => {
        const horarios = turma.horarios?.length ? turma.horarios : [{}];

        return horarios.map((horario) => ({
            matricula_id: turma.matricula_id,
            status_vinculo: turma.status_vinculo,
            turma_id: turma.id,
            turma_nome: turma.nome,
            turno: turma.turno,
            dia_semana: horario.dia_semana,
            hora_inicio: horario.hora_inicio ? String(horario.hora_inicio).slice(11, 16) : null,
            hora_fim: horario.hora_fim ? String(horario.hora_fim).slice(11, 16) : null,
            capacidade_maxima: turma.capacidade_maxima,
            vagas_ocupadas: turma.vagas_ocupadas,
        }));
    });
}


export function Oficinas({ oficinas = [], oficinasDisponiveis = [], turno, idAluno, statusAluno, onSuccess }) {
    const oficinasAgrupadas = agruparOficinas(normalizarTurmas(oficinas.map((matricula) => ({
        ...matricula.turma, matricula_id: matricula.id, status_vinculo: matricula.status,
    }))));
    const oficinasParaSelecao = agruparOficinas(normalizarTurmas(oficinasDisponiveis));
    const quantidadeAtivas = oficinasAgrupadas.filter((oficina) => oficina.status_vinculo === 'ATIVO').length;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selecionadas, setSelecionadas] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [conflitos, setConflitos] = useState([]);
    const [modalView, setModalView] = useState('selecao');
    const [inscricaoParaCancelar, setInscricaoParaCancelar] = useState(null);
    const [cancelando, setCancelando] = useState(false);
    const [erroCancelamento, setErroCancelamento] = useState('');

    function abrirCancelamento(oficina) {
        setErroCancelamento('');
        setInscricaoParaCancelar(oficina);
    }

    function fecharCancelamento() {
        if (cancelando) return;
        setInscricaoParaCancelar(null);
        setErroCancelamento('');
    }

    async function confirmarCancelamento() {
        if (cancelando || !inscricaoParaCancelar) return;
        try {
            setCancelando(true);
            setErroCancelamento('');
            if (inscricaoParaCancelar.status_vinculo === 'PROVISORIO') {
                await matriculasService.removerProvisoria(idAluno, inscricaoParaCancelar.matricula_id);
            } else {
                await matriculasService.cancelarOficina(idAluno, inscricaoParaCancelar.matricula_id);
            }
            setInscricaoParaCancelar(null);
            onSuccess?.();
        } catch (err) {
            setErroCancelamento(err.response?.data?.erro || err.message || 'Não foi possível cancelar a inscrição.');
        } finally {
            setCancelando(false);
        }
    }

    function alternarOficina(oficina) {
        setSelecionadas((atuais) => atuais.includes(oficina.turma_id)
            ? atuais.filter((id) => id !== oficina.turma_id)
            : [...atuais, oficina.turma_id]);
    }

    async function handleMatriculas(e) {
        if (e) e.preventDefault();

        if (!idAluno || selecionadas.length === 0) return;

        setIsSubmitting(true);

        const controller = new AbortController();

        try {
            await matriculasService.matricularOficina(
                idAluno,
                selecionadas,
                controller.signal
            );
            setIsModalOpen(false);
            setSelecionadas([]);
            setConflitos([]);
            setModalView('selecao');
            onSuccess?.();
        } catch (err) {
            if (err.name === 'CanceledError' || err.name === 'AbortError') return;

            const conflitosRecebidos = err.response?.data?.conflitos;
            setConflitos(Array.isArray(conflitosRecebidos)
                ? conflitosRecebidos
                : [err.response?.data?.erro || 'Não foi possível concluir a inscrição.']);
            setModalView('conflitos'); 
            console.log(err);
        } finally {
            setIsSubmitting(false);
        }
    }

    function abrirModal() {
        setConflitos([]);
        setModalView('selecao');
        setIsModalOpen(true);
    }

    function fecharModal() {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setModalView('selecao');
        setConflitos([]);
    }

    function confirmarModal(event) {
        if (modalView === 'conflitos') {
            setModalView('selecao');
            return;
        }

        handleMatriculas(event);
    }

    return (
        <section className="overflow-hidden rounded-md border border-gray-300 bg-bg-surface">
            <header className="flex items-center justify-between gap-md border-b border-gray-300 px-lg py-md">
                <h2 className="text-base font-bold text-text-main">
                    Inscrições Ativas ({quantidadeAtivas})
                </h2>
                <Button onClick={abrirModal}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M6.99365 2.914V11.0732" stroke="white" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2.91406 6.99361H11.0733" stroke="white" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Inscrever em Oficina
                </Button>
                <Modal isOpen={isModalOpen}
                    onClose={fecharModal}
                    title="Selecionar Oficinas para Inscrição"
                    subtitle="Selecione uma ou mais oficinas. Os conflitos serão verificados antes de confirmar."
                    confirmText={modalView === 'conflitos' ? 'Revisar seleção' : 'Verificar e Confirmar'}
                    cancelText="Cancelar"
                    onConfirm={confirmarModal}
                    isConfirmLoading={isSubmitting}
                    isConfirmDisabled={modalView === 'selecao' && selecionadas.length === 0}>
                    {modalView === 'conflitos' ? (
                        <ConflitosOficinas conflitos={conflitos} />
                    ) : oficinasParaSelecao.length > 0 ? (
                        <ul>
                            {oficinasParaSelecao.map((oficina) => (
                                <OficinaItem
                                    key={oficina.turma_id}
                                    oficina={oficina}
                                    turno={turno}
                                    modo="selecao"
                                    planejando={statusAluno === 'RASCUNHO'}
                                    selecionada={selecionadas.includes(oficina.turma_id)}
                                    onToggle={alternarOficina}
                                />
                            ))}
                        </ul>
                    ) : (
                        <p className="py-lg text-center text-sm text-text-muted">
                            Nenhuma oficina disponível para inscrição.
                        </p>
                    )}
                </Modal>
            </header>

            {oficinasAgrupadas.length > 0 ? (
                <ul>
                    {oficinasAgrupadas.map((oficina) => (
                        <OficinaItem
                            key={oficina.matricula_id}
                            oficina={oficina}
                            turno={turno}
                            onCancelar={abrirCancelamento}
                            cancelando={cancelando || isSubmitting}
                        />
                    ))}
                </ul>
            ) : (
                <p className="px-lg py-xl text-center text-sm text-text-muted">
                    Nenhuma oficina ativa encontrada para este aluno.
                </p>
            )}
            <Modal isOpen={Boolean(inscricaoParaCancelar)}
                onClose={fecharCancelamento}
                title="Cancelar inscrição em oficina"
                confirmText="Confirmar cancelamento"
                cancelText="Manter inscrição"
                onConfirm={confirmarCancelamento}
                isConfirmLoading={cancelando}>
                <p className="text-sm text-text-main">
                    Deseja cancelar a inscrição em <strong>{inscricaoParaCancelar?.turma_nome}</strong>?
                </p>
                <p className="mt-sm text-sm text-text-muted">
                    {inscricaoParaCancelar?.status_vinculo === 'PROVISORIO'
                        ? 'Este vínculo provisório será removido por completo do planejamento. Ele não representa uma inscrição efetiva.'
                        : 'O cancelamento vale a partir de hoje. As atividades até ontem continuarão disponíveis no calendário.'}
                </p>
                {erroCancelamento && <p role="alert" className="mt-md text-sm text-red-700">{erroCancelamento}</p>}
            </Modal>
        </section>
    );
}
