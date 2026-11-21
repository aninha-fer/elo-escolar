import { useToast } from '../../contexts/ToastContext';
import { useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { usuariosService } from '../../services/usuariosService';

export function ResetarSenhaUsuario({ usuario, onClose, onSalvo }) {
    const { notificar } = useToast();
    const [formulario, setFormulario] = useState({ senha: '', confirmacao: '' });
    const [erros, setErros] = useState({});
    const [enviando, setEnviando] = useState(false);
    const envioEmAndamento = useRef(false);

    function fecharModal() {
        if (!envioEmAndamento.current) onClose();
    }

    function atualizarCampo(campo, valor) {
        setFormulario((atual) => ({ ...atual, [campo]: valor }));
        setErros((atuais) => ({ ...atuais, [campo]: undefined, ...(campo === 'senha' ? { confirmacao: undefined } : {}) }));
    }

    async function enviar(event) {
        event.preventDefault();
        if (envioEmAndamento.current) return;
        const novosErros = {};
        if (formulario.senha.length < 8 || formulario.senha.length > 100) novosErros.senha = 'A senha deve ter entre 8 e 100 caracteres.';
        if (!formulario.confirmacao || formulario.confirmacao !== formulario.senha) novosErros.confirmacao = 'A confirmação deve ser igual à nova senha.';
        setErros(novosErros);
        const primeiroErro = Object.keys(novosErros)[0];
        if (primeiroErro) {
            event.currentTarget.elements.namedItem(primeiroErro)?.focus();
            return;
        }
        envioEmAndamento.current = true;
        setEnviando(true);
        try {
            const atualizado = await usuariosService.editar(usuario.id, { senha: formulario.senha });
            onSalvo(atualizado);
        } catch (error) {
            const erroSenha = error.response?.data?.erros?.find((item) => item.campo === 'senha');
            setErros(erroSenha ? { senha: erroSenha.mensagem } : {});
            if (!erroSenha) notificar(error.response?.data?.erro || 'Não foi possível redefinir a senha. Tente novamente.');
        } finally {
            envioEmAndamento.current = false;
            setEnviando(false);
        }
    }

    return (
        <Modal testId="usuario-resetar-senha" isOpen onClose={fecharModal} title="Resetar senha" subtitle={`Defina uma nova senha para ${usuario.nome}.`}
            confirmText="Salvar nova senha" confirmFormId="form-resetar-senha" onConfirm={enviar} isConfirmLoading={enviando}>
            <form id="form-resetar-senha" onSubmit={enviar} noValidate>
                <fieldset disabled={enviando} className="min-w-0">
                    {[['senha', 'Nova senha'], ['confirmacao', 'Confirmar nova senha']].map(([campo, label]) => <div key={campo}>
                        <Input data-testid={`usuario-resetar-${campo}`} id={`resetar-${campo}`} name={campo} label={label} labelClassName="font-mono" type="password" required
                            minLength={8} maxLength={100} autoComplete="new-password" placeholder={campo === 'senha' ? 'Mínimo de 8 caracteres' : 'Digite a nova senha novamente'}
                            value={formulario[campo]} onChange={(event) => atualizarCampo(campo, event.target.value)}
                            aria-invalid={Boolean(erros[campo])} aria-describedby={erros[campo] ? `resetar-${campo}-erro` : undefined} />
                        {erros[campo] && <p id={`resetar-${campo}-erro`} className="mb-md text-sm text-red-700">{erros[campo]}</p>}
                    </div>)}
                </fieldset>
            </form>
        </Modal>
    );
}
