import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../../components/Modal';
import { Input } from '../../../components/Input';
import { alunoService } from '../../../services/alunoService';
import { matriculasService } from '../../../services/matriculasService';
import { formatarFrequencia, formatarTurno, obterIniciais } from '../../../utils/formatters';

function normalizarTexto(valor) {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function VincularAlunoModal({ turma, onClose, onVinculado }) {
    const [resultado, setResultado] = useState(null);
    const [tentativa, setTentativa] = useState(0);
    const [busca, setBusca] = useState('');
    const [selecionado, setSelecionado] = useState('');
    const [erroEnvio, setErroEnvio] = useState('');
    const [conflitos, setConflitos] = useState([]);
    const [enviando, setEnviando] = useState(false);
    const envioEmAndamento = useRef(false);

    useEffect(() => {
        const controller = new AbortController();
        async function carregarAlunos() {
            try {
                const dados = await alunoService.listarTodos({}, controller.signal);
                if (!controller.signal.aborted) setResultado({ tentativa, status: 'sucesso', dados });
            } catch (error) {
                if (!controller.signal.aborted) setResultado({ tentativa, status: 'erro', erro: error.response?.data?.erro || 'Não foi possível carregar os alunos.' });
            }
        }
        carregarAlunos();
        return () => controller.abort();
    }, [tentativa]);

    const carregando = !resultado || resultado.tentativa !== tentativa;
    const disponiveis = resultado?.status === 'sucesso'
        ? resultado.dados.filter((aluno) => ['ATIVO', 'RASCUNHO'].includes(aluno.status) && !aluno.turma_regular) : [];
    const filtrados = disponiveis.filter((aluno) => normalizarTexto(aluno.nome || '').includes(normalizarTexto(busca)));
    const alunoSelecionado = disponiveis.find((aluno) => aluno.id === Number(selecionado));

    function fecharModal() {
        if (!envioEmAndamento.current) onClose();
    }

    async function enviar(event) {
        event.preventDefault();
        if (envioEmAndamento.current || carregando || !alunoSelecionado) return;
        envioEmAndamento.current = true;
        setEnviando(true);
        setErroEnvio('');
        setConflitos([]);
        try {
            const matricula = await matriculasService.matricularRegular(alunoSelecionado.id, turma.id);
            onVinculado(matricula);
        } catch (error) {
            setErroEnvio(error.response?.data?.erro || 'Não foi possível vincular o aluno. Tente novamente.');
            setConflitos(error.response?.data?.conflitos ?? []);
        } finally {
            envioEmAndamento.current = false;
            setEnviando(false);
        }
    }

    return (
        <Modal isOpen title="Vincular Aluno" subtitle={`Selecione um aluno para ${turma.nome}.`}
            onClose={fecharModal} confirmText="Vincular Aluno" confirmFormId="form-vincular-aluno" onConfirm={enviar}
            isConfirmDisabled={carregando || !alunoSelecionado} isConfirmLoading={enviando}>
            <form id="form-vincular-aluno" onSubmit={enviar} noValidate>
                <fieldset disabled={enviando}>
                    <p className="mb-md text-sm text-slate-500">São exibidos alunos ativos ou em rascunho que ainda não possuem turma regular. O turno, os dias de frequência e as vagas serão validados ao confirmar.</p>
                    <Input id="vinculo-busca-aluno" label="Buscar aluno" placeholder="Buscar por nome..." value={busca}
                        onChange={(event) => setBusca(event.target.value)} />
                    {carregando ? <p role="status" className="py-md text-sm text-slate-500">Carregando alunos...</p>
                        : resultado.status === 'erro' ? <div className="rounded-sm bg-red-50 p-md text-sm text-red-700">
                            <p role="alert">{resultado.erro}</p><button type="button" className="mt-sm underline" onClick={() => setTentativa((atual) => atual + 1)}>Tentar novamente</button>
                        </div> : <fieldset className="mb-md min-w-0">
                            <legend className="mb-sm text-xs font-semibold uppercase tracking-wider text-slate-600">Aluno <span className="text-danger">*</span></legend>
                            <div className="max-h-72 overflow-y-auto rounded-sm border border-slate-200 divide-y divide-slate-200">
                                {filtrados.length === 0 ? <p role="status" className="p-md text-sm text-slate-500">{disponiveis.length ? 'Nenhum aluno encontrado para esta busca.' : 'Nenhum aluno sem turma regular disponível.'}</p>
                                    : filtrados.map((aluno) => <label key={aluno.id} className="flex cursor-pointer items-center gap-sm p-md hover:bg-bg-main has-checked:bg-blue-50">
                                        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">{obterIniciais(aluno.nome)}</span>
                                        <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{aluno.nome}</span>
                                            <span className="block text-xs text-slate-500">{formatarTurno(aluno.turno)} · {aluno.dias_frequencia?.length ? formatarFrequencia(aluno.dias_frequencia) : 'Dias não informados'}{aluno.status === 'RASCUNHO' ? ' · Rascunho' : ''}</span>
                                        </span>
                                        <input type="radio" name="aluno_id" value={aluno.id} checked={selecionado === String(aluno.id)} required
                                            onChange={(event) => { setSelecionado(event.target.value); setErroEnvio(''); setConflitos([]); }} className="size-4 shrink-0 accent-blue-600" />
                                    </label>)}
                            </div>
                        </fieldset>}
                    {alunoSelecionado?.status === 'RASCUNHO' && <p role="status" className="mb-md rounded-sm bg-amber-50 p-md text-sm text-amber-800">Este aluno está em rascunho. O vínculo será provisório, sem ocupar vaga. Ele aparecerá nesta turma após a ativação e nova validação da disponibilidade.</p>}
                    {erroEnvio && <div role="alert" className="rounded-sm bg-red-50 p-md text-sm text-red-700"><p>{erroEnvio}</p>
                        {conflitos.length > 0 && <ul className="mt-sm list-disc space-y-xs pl-md">{conflitos.map((conflito, indice) => <li key={indice}>{conflito.mensagem || 'Não foi possível concluir o vínculo por incompatibilidade com a turma.'}</li>)}</ul>}
                    </div>}
                </fieldset>
            </form>
        </Modal>
    );
}
