import { useToast } from '../../contexts/ToastContext';
import { useRef, useState } from 'react';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { ModalConfirmacao } from '../../components/ModalConfirmacao';
import { SaveIcon } from '../../components/icons/SaveIcon';
import { anosLetivosService } from '../../services/anosLetivosService';
import { hojeInstituicao } from '../../utils/anoLetivo';

export function FormularioAnoLetivo({ calendario, onSalvo }) {
    const { notificar } = useToast();
    const [dados, setDados] = useState(() => ({ ano: calendario?.ano ?? Number(hojeInstituicao().slice(0, 4)),
        data_inicio: calendario?.data_inicio.slice(0, 10) ?? '', data_fim: calendario?.data_fim.slice(0, 10) ?? '' }));
    const [erros, setErros] = useState({});
    const [erro, setErro] = useState(null);
    const [confirmacao, setConfirmacao] = useState(null);
    const [enviando, setEnviando] = useState(false);
    const envio = useRef(false);
    const hoje = hojeInstituicao();
    const inicioBloqueado = Boolean(calendario && calendario.data_inicio.slice(0, 10) <= hoje);
    const fimBloqueado = Boolean(calendario && calendario.data_fim.slice(0, 10) < hoje);

    async function salvar(token) {
        if (envio.current) return;
        const novosErros = {};
        if (!Number.isInteger(Number(dados.ano)) || Number(dados.ano) < 1 || Number(dados.ano) > 9999) novosErros.ano = 'Informe um ano entre 1 e 9999.';
        if (!dados.data_inicio) novosErros.data_inicio = 'Informe a data inicial.';
        if (!dados.data_fim) novosErros.data_fim = 'Informe a data final.';
        else if (dados.data_fim < dados.data_inicio) novosErros.data_fim = 'O término deve ser igual ou posterior ao início.';
        setErros(novosErros);
        if (Object.keys(novosErros).length) return;
        envio.current = true;
        setEnviando(true);
        setErro(null);
        try {
            const entrada = { ...dados, ano: Number(dados.ano) };
            if (calendario) await anosLetivosService.editar(calendario.id, { ...entrada, ...(token ? { confirmar_alteracao_fim: token } : {}) });
            else await anosLetivosService.criar(entrada);
            setConfirmacao(null);
            if (!calendario) setDados({ ano: Number(hoje.slice(0, 4)), data_inicio: '', data_fim: '' });
            notificar(calendario ? 'Calendário atualizado com sucesso.' : 'Calendário cadastrado com sucesso.', 'sucesso');
            onSalvo();
        } catch (error) {
            const resposta = error.response?.data;
            if (resposta?.confirmacao) setConfirmacao(resposta.confirmacao);
            else {
                setConfirmacao(null);
                if (resposta?.erros) setErros(Object.fromEntries(resposta.erros.map((e) => [e.path[0], e.message])));
                else if (resposta?.conflitos?.length) setErro({ mensagem: resposta?.erro || 'Não foi possível salvar o calendário.', conflitos: resposta.conflitos });
                else notificar(resposta?.erro || 'Não foi possível salvar o calendário.');
            }
        } finally { envio.current = false; setEnviando(false); }
    }

    return <>
        <form noValidate onSubmit={(event) => { event.preventDefault(); salvar(); }}>
            <div className="grid grid-cols-1 gap-md sm:grid-cols-[1fr_1.5fr_1.5fr]">
                {[
                    ['ano', 'Ano', 'number', Boolean(calendario?.possui_turmas)],
                    ['data_inicio', 'Início', 'date', inicioBloqueado],
                    ['data_fim', 'Término', 'date', fimBloqueado],
                ].map(([campo, label, type, bloqueado]) => <div key={campo}>
                    <Input id={`calendario-${calendario?.id ?? 'novo'}-${campo}`} data-testid={`calendario-${calendario?.id ?? 'novo'}-${campo}`}
                        label={label} name={campo} type={type} required disabled={enviando || bloqueado} value={dados[campo]}
                        onChange={(event) => { setDados((atual) => ({ ...atual, [campo]: event.target.value })); setErros((atual) => ({ ...atual, [campo]: '' })); }}
                        aria-invalid={Boolean(erros[campo])} aria-describedby={erros[campo] ? `calendario-erro-${campo}` : undefined} />
                    {erros[campo] && <p id={`calendario-erro-${campo}`} className="mb-sm text-sm text-danger">{erros[campo]}</p>}
                </div>)}
            </div>
            {erro && <div role="alert" className="mb-md rounded-sm bg-red-50 p-sm text-sm text-danger">
                <p>{erro.mensagem}</p>
                {erro.conflitos && <ul className="mt-sm list-disc pl-lg">{erro.conflitos.map((c, i) => <li key={i}>{c.mensagem}</li>)}</ul>}
            </div>}
            <div className="flex justify-end border-t border-slate-200 pt-md">
                <Button data-testid={`calendario-${calendario?.id ?? 'novo'}-salvar`} type="submit" loading={enviando} loadingLabel="Salvando calendário..." className="disabled:opacity-50">
                    <SaveIcon /> {calendario ? 'Salvar alterações' : 'Cadastrar calendário'}
                </Button>
            </div>
        </form>
        <ModalConfirmacao testId="calendario-confirmar-termino" isOpen={Boolean(confirmacao)} onClose={() => { if (!enviando) setConfirmacao(null); }}
            title="Alterar término do calendário?" description="A mudança afeta a agenda das turmas regulares vinculadas e das oficinas exibidas nesse período. O status das turmas e das matrículas será preservado."
            confirmText="Confirmar alteração" isConfirmLoading={enviando} onConfirm={() => salvar(confirmacao)} />
    </>;
}
