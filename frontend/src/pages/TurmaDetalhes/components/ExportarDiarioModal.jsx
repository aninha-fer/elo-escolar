import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../../components/Modal';
import { Select } from '../../../components/Select';
import { useToast } from '../../../contexts/ToastContext';
import { turmasService } from '../../../services/turmasService';
import { criarArquivoDiario, mesesDiario } from '../../../utils/exportarDiarioTurma';
import { hojeInstituicao } from '../../../utils/anoLetivo';
import { baixarArquivo } from '../../../utils/baixarArquivo';

export function ExportarDiarioModal({ turma, onClose }) {
    const { notificar } = useToast();
    const [mes, setMes] = useState(() => mesesDiario(turma.ano_letivo)[0]?.value ?? '');
    const [enviando, setEnviando] = useState(false);
    const [hoje, setHoje] = useState(hojeInstituicao);
    const envio = useRef(null);
    const opcoes = mesesDiario(turma.ano_letivo, hoje);
    const mesValido = opcoes.some(opcao => opcao.value === mes);
    useEffect(() => {
        const atualizar = () => setHoje(hojeInstituicao());
        const timer = setInterval(atualizar, 60000);
        window.addEventListener('focus', atualizar);
        return () => { clearInterval(timer); window.removeEventListener('focus', atualizar); envio.current?.abort(); };
    }, []);

    async function exportar(event) {
        event.preventDefault();
        if (envio.current || !mesValido) return;
        const controller = new AbortController(); envio.current = controller;
        setEnviando(true);
        try {
            const dados = await turmasService.buscarDiario(turma.id, Number(mes), controller.signal);
            if (controller.signal.aborted) return;
            const { arquivo, nome } = await criarArquivoDiario(dados, Number(mes));
            if (controller.signal.aborted) return;
            baixarArquivo(arquivo, nome);
            notificar('Diário de classe exportado com sucesso.', 'sucesso');
            onClose();
        } catch (error) {
            if (!controller.signal.aborted && error.code !== 'ERR_CANCELED') notificar(error.response?.data?.erro || 'Não foi possível exportar o diário de classe. Tente novamente.');
        } finally {
            if (envio.current === controller && !controller.signal.aborted) { envio.current = null; setEnviando(false); }
        }
    }

    return <Modal testId="turma-diario" isOpen onClose={() => { if (!envio.current) onClose(); }} title="Exportar diário de classe"
        subtitle={`${turma.nome} · Ano letivo ${turma.ano_letivo?.ano ?? 'não informado'}`}
        confirmText="Exportar diário de classe" confirmFormId="turma-diario-formulario" onConfirm={exportar}
        isConfirmLoading={enviando} isConfirmDisabled={!mesValido}>
        <form id="turma-diario-formulario" onSubmit={exportar}>
            <Select data-testid="turma-diario-mes" id="turma-diario-mes" label="Mês" required value={mes} disabled={enviando || !opcoes.length}
                onChange={event => setMes(event.target.value)} options={opcoes} />
            {!opcoes.length && <p role="status" className="text-sm text-text-muted">Não há meses disponíveis para exportação no calendário letivo desta turma.</p>}
        </form>
    </Modal>;
}
