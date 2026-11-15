import { useId, useRef, useState } from 'react';
import { Input } from '../../../components/Input';
import { Modal } from '../../../components/Modal';
import { ocorrenciasService } from '../../../services/ocorrenciasService';
import { formatarDataHoraInstituicao } from '../../../utils/formatters';

export function FormularioOcorrencia({ idAluno, ocorrencia, onClose, onSuccess }) {
    const id = useId();
    const inicial = formatarDataHoraInstituicao(ocorrencia ? new Date(ocorrencia.ocorrido_em) : new Date());
    const [formulario, setFormulario] = useState({ resumo: ocorrencia?.resumo ?? '', descricao: ocorrencia?.descricao ?? '',
        data: inicial.slice(0, 10), hora: inicial.slice(11, 16) });
    const [erros, setErros] = useState({});
    const [erro, setErro] = useState('');
    const [salvando, setSalvando] = useState(false);
    const ocupado = useRef(false);
    const formularioRef = useRef(null);

    function alterar(event) {
        const { name, value } = event.target;
        setFormulario((atual) => ({ ...atual, [name]: value }));
        setErros((atuais) => ({ ...atuais, [name]: undefined }));
    }

    function atributos(campo) {
        return { id: `${id}-${campo}`, name: campo, value: formulario[campo], onChange: alterar,
            required: true, 'aria-invalid': Boolean(erros[campo]),
            'aria-describedby': erros[campo] ? `${id}-${campo}-erro` : undefined };
    }

    function mensagem(campo) {
        return erros[campo] && <p id={`${id}-${campo}-erro`} role="alert" className="mb-md text-xs text-red-700">{erros[campo]}</p>;
    }

    async function salvar(event) {
        event.preventDefault();
        if (ocupado.current) return;
        const problemas = {};
        if (!formulario.resumo.trim()) problemas.resumo = 'Informe o resumo.';
        else if (formulario.resumo.trim().length > 200) problemas.resumo = 'O resumo deve ter no máximo 200 caracteres.';
        if (!formulario.descricao.trim()) problemas.descricao = 'Informe a descrição.';
        if (!formulario.data) problemas.data = 'Informe a data.';
        else if (formulario.data > formatarDataHoraInstituicao().slice(0, 10)) problemas.data = 'A data da ocorrência não pode ser futura.';
        if (!formulario.hora) problemas.hora = 'Informe o horário.';
        setErros(problemas);
        setErro('');
        if (Object.keys(problemas).length) {
            formularioRef.current?.elements.namedItem(Object.keys(problemas)[0])?.focus();
            return;
        }
        ocupado.current = true;
        setSalvando(true);
        try {
            if (ocorrencia) await ocorrenciasService.editar(idAluno, ocorrencia.id, formulario);
            else await ocorrenciasService.criar(idAluno, formulario);
            onSuccess();
        } catch (error) {
            const campos = {};
            const gerais = [];
            for (const item of error.response?.data?.erros ?? []) {
                const campo = item.path?.[0];
                if (Object.hasOwn(formulario, campo)) campos[campo] ??= item.message;
                else gerais.push(item.message);
            }
            const mensagemErro = error.response?.data?.erro;
            if (mensagemErro === 'A data da ocorrência não pode ser futura.') campos.data = mensagemErro;
            setErros(campos);
            setErro(Object.keys(campos).length ? gerais.join(' ') : mensagemErro || gerais.join(' ') || 'Não foi possível salvar a ocorrência.');
        } finally { ocupado.current = false; setSalvando(false); }
    }

    return <Modal isOpen onClose={() => { if (!ocupado.current) onClose(); }} title={ocorrencia ? 'Editar ocorrência' : 'Nova ocorrência'}
        subtitle="Campos com * são obrigatórios." confirmText={ocorrencia ? 'Salvar alterações' : 'Registrar ocorrência'}
        confirmFormId={id} onConfirm={salvar} isConfirmLoading={salvando}>
        <form id={id} ref={formularioRef} onSubmit={salvar} noValidate>
            <div className="grid grid-cols-1 gap-x-md sm:grid-cols-2">
                <div className="sm:col-span-2"><Input {...atributos('resumo')} label="Resumo" maxLength={200} placeholder="Ex: Queda no corredor" />{mensagem('resumo')}</div>
                <div><Input {...atributos('data')} label="Data" type="date" max={formatarDataHoraInstituicao().slice(0, 10)} />{mensagem('data')}</div>
                <div><Input {...atributos('hora')} label="Hora" type="time" />{mensagem('hora')}</div>
            </div>
            <label htmlFor={`${id}-descricao`} className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600">Descrição <span className="text-red-500">*</span></label>
            <textarea {...atributos('descricao')} rows={4} placeholder="Descreva o que aconteceu e quais providências foram tomadas."
                className="mb-sm w-full rounded-sm border border-slate-200 bg-bg-surface p-sm text-text-main placeholder:text-placeholder focus:outline-none focus:ring-1" />
            {mensagem('descricao')}
            {erro && <p role="alert" className="rounded-sm bg-red-50 p-sm text-sm text-red-700">{erro}</p>}
        </form>
    </Modal>;
}
