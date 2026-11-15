import { useRef, useState } from 'react';
import { Button } from '../../../components/Button';
import { BotaoAcoes } from '../../../components/BotaoAcoes';
import { ModalConfirmacao } from '../../../components/ModalConfirmacao';
import EditIcon from '../../../components/icons/EditIcon';
import { TrashIcon } from '../../../components/icons/TrashIcon';
import { ocorrenciasService } from '../../../services/ocorrenciasService';
import { formatarDataBR, formatarDataHoraInstituicao } from '../../../utils/formatters';
import { FormularioOcorrencia } from './FormularioOcorrencia';

export function Ocorrencias({ ocorrencias = [], idAluno, onSuccess, carregando, erro, onTentarNovamente }) {
    const [operacao, setOperacao] = useState(null);
    const [excluindo, setExcluindo] = useState(false);
    const [erroExclusao, setErroExclusao] = useState('');
    const ocupado = useRef(false);

    function salvo() { setOperacao(null); onSuccess(); }
    function fechar() { if (!ocupado.current) setOperacao(null); }

    async function excluir() {
        if (ocupado.current || operacao?.tipo !== 'excluir') return;
        ocupado.current = true;
        setExcluindo(true);
        setErroExclusao('');
        try {
            await ocorrenciasService.excluir(idAluno, operacao.ocorrencia.id);
            salvo();
        } catch (error) {
            setErroExclusao(error.response?.data?.erro || 'Não foi possível excluir a ocorrência.');
        } finally { ocupado.current = false; setExcluindo(false); }
    }

    return <section className="overflow-hidden rounded-md border border-gray-300 bg-bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-md border-b border-gray-300 px-lg py-md">
            <div><h2 className="text-base font-bold text-text-main">Ocorrências do aluno</h2>
                <p className="mt-xs text-sm text-text-muted">Registro de situações relevantes observadas no dia a dia.</p></div>
            <Button data-testid="aluno-ocorrencias-nova" onClick={() => setOperacao({ tipo: 'criar' })} disabled={excluindo}>
                <span aria-hidden="true">+</span> Nova ocorrência
            </Button>
        </header>
        {carregando ? <p role="status" className="p-lg text-sm text-text-muted">Carregando ocorrências...</p>
            : erro ? <div role="alert" className="m-md rounded-sm bg-red-50 p-sm text-sm text-red-700">{erro}
                <button data-testid="ocorrencias-tentar-novamente" type="button" onClick={onTentarNovamente} className="ml-sm underline">Tentar novamente</button></div>
                : ocorrencias.length ? <ul>{ocorrencias.map((ocorrencia) => {
                    const dataHora = formatarDataHoraInstituicao(new Date(ocorrencia.ocorrido_em));
                    return <li key={ocorrencia.id} className="flex items-start gap-md border-b border-gray-200 p-lg last:border-b-0">
                        <time dateTime={ocorrencia.ocorrido_em} className="shrink-0 text-sm">
                            <span className="block font-semibold text-secondary">{formatarDataBR(dataHora)}</span>
                            <span className="text-text-muted">{dataHora.slice(11, 16)}</span>
                        </time>
                        <div className="min-w-0 flex-1 break-words">
                            <h3 className="font-bold text-text-main">{ocorrencia.resumo}</h3>
                            <p className="mt-xs whitespace-pre-wrap text-sm text-text-main">{ocorrencia.descricao}</p>
                            <p className="mt-sm text-xs text-text-muted">Relator: {ocorrencia.usuario_relator.pessoa.nome}</p>
                        </div>
                        <BotaoAcoes testId={`ocorrencia-${ocorrencia.id}-acoes`} label={`Ações de ${ocorrencia.resumo}`} disabled={excluindo} options={[
                            { id: 'editar', label: 'Editar', icon: <EditIcon />, onClick: () => setOperacao({ tipo: 'editar', ocorrencia }) },
                            { id: 'excluir', label: 'Excluir', icon: <TrashIcon />, textColor: 'var(--color-danger)', onClick: () => { setErroExclusao(''); setOperacao({ tipo: 'excluir', ocorrencia }); } },
                        ]} />
                    </li>;
                })}</ul> : <p className="p-lg text-center text-sm text-text-muted">Nenhuma ocorrência registrada para este aluno.</p>}
        {['criar', 'editar'].includes(operacao?.tipo) && <FormularioOcorrencia key={operacao.ocorrencia?.id ?? 'nova'}
            idAluno={idAluno} ocorrencia={operacao.ocorrencia} onClose={fechar} onSuccess={salvo} />}
        {operacao?.tipo === 'excluir' && <ModalConfirmacao testId="ocorrencia-excluir" isOpen estado="atencao" title="Excluir ocorrência?"
            confirmText="Confirmar exclusão" onClose={fechar} onConfirm={excluir} isConfirmLoading={excluindo}
            description={<>Deseja excluir <strong>{operacao.ocorrencia.resumo}</strong>? Essa ação não pode ser desfeita.
                {erroExclusao && <span role="alert" className="mt-md block text-sm text-red-700">{erroExclusao}</span>}</>} />}
    </section>;
}
