import { useRef, useState } from 'react';
import { Button } from '../../../components/Button';
import { AtendimentoItem } from '../../../components/AtendimentoItem';
import { ModalConfirmacao } from '../../../components/ModalConfirmacao';
import { atendimentosService } from '../../../services/atendimentosService';
import { FormularioAtendimento } from './FormularioAtendimento';

export function Atendimentos({ atendimentos = [], total = atendimentos.length, idAluno, statusAluno, onSuccess, permissao }) {
    const [operacao, setOperacao] = useState(null);
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState('');
    const [erroCancelamento, setErroCancelamento] = useState('');
    const [cancelando, setCancelando] = useState(false);
    const ocupada = useRef(false);

    async function abrirEdicao(atendimento) {
        if (ocupada.current) return;
        ocupada.current = true;
        setCarregando(true);
        setErro('');
        try {
            const dados = await atendimentosService.buscarPorId(idAluno, atendimento.id);
            if (!dados.pode_editar) { setErro('Este atendimento não permite edição após o início ou cancelamento.'); return; }
            setOperacao({ tipo: 'editar', atendimento: dados });
        } catch (error) {
            setErro(error.response?.data?.erro || 'Não foi possível carregar o atendimento.');
        } finally { ocupada.current = false; setCarregando(false); }
    }

    function abrirCancelamento(atendimento) {
        if (ocupada.current) return;
        setErroCancelamento('');
        setOperacao({ tipo: 'cancelar', atendimento });
    }

    function fechar() { if (!ocupada.current) setOperacao(null); }
    function salvo() { setOperacao(null); onSuccess?.(); }

    async function confirmarCancelamento() {
        if (ocupada.current || operacao?.tipo !== 'cancelar') return;
        ocupada.current = true;
        setCancelando(true);
        setErroCancelamento('');
        try {
            await atendimentosService.cancelar(idAluno, operacao.atendimento.id);
            salvo();
        } catch (error) {
            setErroCancelamento(error.response?.data?.erro || 'Não foi possível cancelar o atendimento.');
        } finally { ocupada.current = false; setCancelando(false); }
    }

    return (
        <section className="overflow-hidden rounded-md border border-gray-300 bg-bg-surface">
            <header className="flex items-center justify-between gap-md border-b border-gray-300 px-lg py-md">
                <h2 className="text-base font-bold text-text-main">Atendimentos Clínicos ({total})</h2>
                {permissao && <Button data-testid="aluno-atendimentos-novo" tooltip={statusAluno === 'INATIVO' ? 'Este aluno está inativo.' : undefined} disabled={carregando || cancelando || statusAluno === 'INATIVO'} onClick={() => { setErro(''); setOperacao({ tipo: 'criar' }); }}>
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                    Novo Atendimento
                </Button>}
            </header>
            {carregando && <p role="status" className="p-md text-sm text-text-muted">Carregando atendimento...</p>}
            {erro && <p role="alert" className="m-md rounded-sm bg-red-50 p-sm text-sm text-red-700">{erro}</p>}
            {atendimentos.length ? <ul>{atendimentos.map((atendimento) => <AtendimentoItem key={atendimento.id} atendimento={atendimento}
                onEditar={permissao && statusAluno !== 'INATIVO' ? abrirEdicao : undefined}
                onCancelar={permissao ? abrirCancelamento : undefined} cancelando={cancelando || carregando} />)}</ul>
                : <p className="px-lg py-xl text-center text-sm text-text-muted">Nenhum atendimento vigente encontrado para este aluno.</p>}
            {permissao && ['criar', 'editar'].includes(operacao?.tipo) && <FormularioAtendimento key={operacao.atendimento?.id ?? 'novo'}
                atendimento={operacao.atendimento} idAluno={idAluno} onClose={fechar} onSuccess={salvo} />}
            {permissao && operacao?.tipo === 'cancelar' && <ModalConfirmacao testId="atendimento-cancelar" isOpen onClose={fechar} estado="atencao" showCancel
                title="Cancelar atendimento?" confirmText="Confirmar cancelamento" isConfirmLoading={cancelando} onConfirm={confirmarCancelamento}
                description={<>Deseja cancelar <strong>{operacao.atendimento.modalidade}</strong>?{' '}
                    {operacao.atendimento.status === 'PROVISORIO'
                        ? 'As sessões serão canceladas e essa ação não pode ser desfeita.'
                        : 'As sessões futuras serão canceladas e as já realizadas não serão afetadas.'}
                    {erroCancelamento && <span role="alert" className="mt-md block text-sm text-red-700">{erroCancelamento}</span>}
                </>} />}
        </section>
    );
}
