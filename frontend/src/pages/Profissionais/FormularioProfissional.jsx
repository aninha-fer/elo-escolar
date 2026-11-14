import { useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { profissionaisService } from '../../services/profissionaisService';

const funcoes = ['Professor', 'Terapeuta', 'Auxiliar'];

export function FormularioProfissional({ profissional, onClose, onCriado, onSalvo }) {
    const editando = Boolean(profissional);
    const [formulario, setFormulario] = useState(() => ({ nome: profissional?.nome ?? '', telefone: profissional?.telefone ?? '', cargo: profissional?.funcao ?? '' }));
    const [erros, setErros] = useState({});
    const [erroEnvio, setErroEnvio] = useState('');
    const [enviando, setEnviando] = useState(false);
    const envioEmAndamento = useRef(false);
    const funcoesDisponiveis = [...new Set([...funcoes, ...(profissional?.funcao ? [profissional.funcao] : [])])];
    const dadosAlterados = {
        ...(editando && formulario.nome.trim() !== profissional.nome ? { nome: formulario.nome.trim() } : {}),
        ...(editando && (formulario.telefone.replace(/\D/g, '') || null) !== profissional.telefone ? { telefone: formulario.telefone.replace(/\D/g, '') || null } : {}),
        ...(editando && formulario.cargo !== profissional.funcao ? { cargo: formulario.cargo } : {}),
    };

    function atualizarCampo(campo, valor) {
        setFormulario((atual) => ({ ...atual, [campo]: valor }));
        setErros((atuais) => ({ ...atuais, [campo]: undefined }));
        setErroEnvio('');
    }

    function fecharModal() {
        if (!envioEmAndamento.current) onClose();
    }

    async function enviar(event) {
        event.preventDefault();
        if (envioEmAndamento.current) return;
        const form = event.currentTarget;
        const nome = formulario.nome.trim();
        const telefone = formulario.telefone.replace(/\D/g, '');
        const novosErros = {};
        if (nome.length < 2) novosErros.nome = 'Informe o nome completo, com pelo menos 2 caracteres.';
        if (telefone && !/^\d{10,11}$/.test(telefone)) novosErros.telefone = 'Informe um telefone com DDD e 10 ou 11 dígitos.';
        if (formulario.telefone.trim() && !telefone) novosErros.telefone = 'Informe um telefone válido ou deixe o campo vazio.';
        if (!funcoesDisponiveis.includes(formulario.cargo)) novosErros.cargo = 'Selecione uma função.';
        setErros(novosErros);
        setErroEnvio('');
        const primeiroErro = Object.keys(novosErros)[0];
        if (primeiroErro) {
            form.querySelector(`[name="${primeiroErro}"]`)?.focus();
            return;
        }

        if (editando && !Object.keys(dadosAlterados).length) return;
        envioEmAndamento.current = true;
        setEnviando(true);
        try {
            if (editando) {
                const atualizado = await profissionaisService.editar(profissional.id, dadosAlterados);
                onSalvo(atualizado);
            } else {
                const criado = await profissionaisService.criar({ nome, cargo: formulario.cargo, ...(telefone ? { telefone } : {}) });
                onCriado(criado);
            }
        } catch (error) {
            const errosCampos = {};
            for (const item of error.response?.data?.erros ?? []) {
                const campo = item.path?.[0];
                if (['nome', 'telefone', 'cargo'].includes(campo)) errosCampos[campo] = item.message;
            }
            setErros(errosCampos);
            setErroEnvio(error.response?.data?.erro || `Não foi possível ${editando ? 'editar' : 'cadastrar'} o profissional. Verifique os dados e tente novamente.`);
        } finally {
            envioEmAndamento.current = false;
            setEnviando(false);
        }
    }

    function acessibilidadeCampo(campo) {
        return { 'aria-invalid': Boolean(erros[campo]), 'aria-describedby': erros[campo] ? `profissional-${campo}-erro` : undefined };
    }

    return (
        <div className="profissional-modal">
            <Modal isOpen onClose={fecharModal} title={editando ? 'Editar Profissional' : 'Cadastrar Profissional'} subtitle={<>Campos com <span className="text-danger">*</span> são obrigatórios</>}
                confirmText={
                    <span className="inline-flex items-center gap-sm">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z" /><path d="M7 3v6h10V3M7 21v-8h10v8" />
                        </svg>
                        {editando ? 'Salvar alterações' : 'Cadastrar Profissional'}
                    </span>
                } cancelText="Cancelar" confirmFormId="form-cadastro-profissional" onConfirm={enviar}
                isConfirmLoading={enviando} isConfirmDisabled={!formulario.nome.trim() || !formulario.cargo || (editando && !Object.keys(dadosAlterados).length)}>
                <form id="form-cadastro-profissional" onSubmit={enviar} noValidate>
                    <fieldset disabled={enviando} className="min-w-0">
                        <Input id="profissional-nome" name="nome" label="Nome completo" placeholder="Ex: João Silva" autoComplete="name" required
                            labelClassName="font-mono" value={formulario.nome} onChange={(event) => atualizarCampo('nome', event.target.value)} {...acessibilidadeCampo('nome')} />
                        {erros.nome && <p id="profissional-nome-erro" className="mb-md text-sm text-red-700">{erros.nome}</p>}
                        <Input id="profissional-telefone" name="telefone" label="Telefone" type="tel" placeholder="(11) 99999-9999" autoComplete="tel-national" maxLength={20}
                            labelClassName="font-mono" value={formulario.telefone} onChange={(event) => atualizarCampo('telefone', event.target.value)} {...acessibilidadeCampo('telefone')} />
                        {erros.telefone && <p id="profissional-telefone-erro" className="mb-md text-sm text-red-700">{erros.telefone}</p>}
                        <fieldset className="mb-md" {...acessibilidadeCampo('cargo')}>
                            <legend className="mb-sm font-mono text-xs font-semibold uppercase tracking-wider text-slate-600">Função <span className="text-danger">*</span></legend>
                            <div className="flex flex-wrap gap-sm">
                                {funcoesDisponiveis.map((funcao) => (
                                    <label key={funcao} className="cursor-pointer">
                                        <input type="radio" name="cargo" value={funcao} checked={formulario.cargo === funcao} required
                                            onChange={(event) => atualizarCampo('cargo', event.target.value)} className="peer sr-only" />
                                        <span className="inline-flex rounded-full border-2 border-slate-200 px-md py-sm text-base text-slate-500 transition-colors peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 peer-disabled:cursor-wait peer-disabled:opacity-50">{funcao}</span>
                                    </label>
                                ))}
                            </div>
                            {erros.cargo && <p id="profissional-cargo-erro" className="mt-sm text-sm text-red-700">{erros.cargo}</p>}
                        </fieldset>
                        {erroEnvio && <p role="alert" className="mt-md rounded-sm bg-red-50 p-sm text-sm text-red-700">{erroEnvio}</p>}
                    </fieldset>
                </form>
            </Modal>
        </div>
    );
}
