import { useState } from "react";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import { OficinaItem } from "../../../components/OficinaItem";
import { matriculasService } from "../../../services/matriculasService";
import { ConflitosOficinas } from "./ConflitosOficinas";

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
            const chave = oficina.turma_id ?? oficina.turma_nome;
            const grupoAtual = grupos[chave] ?? {
                ...oficina,
                dias: [],
            };

            if (!grupoAtual.dias.some((dia) => dia.numero === oficina.dia_semana)) {
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

function normalizarOficinasDisponiveis(turmas) {
    return (Array.isArray(turmas) ? turmas : []).flatMap((turma) => {
        const horarios = Array.isArray(turma.horarios) ? turma.horarios : [];

        return horarios.map((horario) => ({
            turma_id: turma.id,
            turma_nome: turma.nome,
            turno: turma.turno,
            dia_semana: horario.dia_semana,
            hora_inicio: String(horario.hora_inicio).slice(11, 16),
            hora_fim: String(horario.hora_fim).slice(11, 16),
            capacidade_maxima: turma.capacidade_maxima,
            vagas_ocupadas: turma.vagas_ocupadas,
        }));
    });
}


export function Oficinas({ oficinas = [], oficinasDisponiveis = [], turno, idAluno, onSuccess }) {
    const oficinasAgrupadas = agruparOficinas(oficinas);
    const oficinasParaSelecao = agruparOficinas(normalizarOficinasDisponiveis(oficinasDisponiveis));
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selecionadas, setSelecionadas] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [conflitos, setConflitos] = useState([]);
    const [modalView, setModalView] = useState('selecao');

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
                    Inscrições Ativas ({oficinasAgrupadas.length})
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
                            key={oficina.turma_id ?? oficina.turma_nome}
                            oficina={oficina}
                            turno={turno}
                        />
                    ))}
                </ul>
            ) : (
                <p className="px-lg py-xl text-center text-sm text-text-muted">
                    Nenhuma oficina ativa encontrada para este aluno.
                </p>
            )}
        </section>
    );
}
