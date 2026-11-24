import { useToast } from '../../../contexts/ToastContext';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { LoginIcon } from './LoginIcon';

export function LoginForm() {
    const { notificar } = useToast();
    const location = useLocation();
    const { entrar, avisoSessao } = useAuth();
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [mostrarSenha, setMostrarSenha] = useState(false);
    const [erros, setErros] = useState({});
    const avisoInicial = useRef(location.state?.aviso || avisoSessao);
    useEffect(() => {
        if (avisoInicial.current) {
            notificar(avisoInicial.current);
            avisoInicial.current = null;
        }
    }, [notificar]);
    const navigate = useNavigate();
    const [enviando, setEnviando] = useState(false);
    const envio = useRef(false);

    function alterarCampo(campo, valor) {
        if (campo === 'email') setEmail(valor);
        else setSenha(valor);
        setErros((atuais) => ({ ...atuais, [campo]: undefined }));
    }

    async function enviar(event) {
        event.preventDefault();
        if (envio.current) return;
        const campos = event.currentTarget.elements;
        const novosErros = {};

        if (!email.trim()) novosErros.email = 'Informe seu e-mail.';
        else if (campos.email.validity.typeMismatch) novosErros.email = 'Informe um e-mail válido.';
        if (!senha) novosErros.senha = 'Informe sua senha.';
        else if (senha.length < 8) novosErros.senha = 'A senha deve ter pelo menos 8 caracteres.';

        setErros(novosErros);
        const primeiroErro = Object.keys(novosErros)[0];
        if (primeiroErro) {
            campos[primeiroErro].focus();
            return;
        }

        envio.current = true;
        setEnviando(true);

        try {
            await entrar({ email: email.trim(), senha });
            navigate('/', { replace: true });
        } catch (error) {
            const codigo = error.response?.status;

            if (error.code === 'ERR_CANCELED') return;
            if (['RESULTADO_NAO_CONFIRMADO', 'CONEXAO_INDISPONIVEL', 'RESPOSTA_INVALIDA'].includes(error.code)) {
                notificar(error.response.data.erro);
            } else if (codigo === 401) {
                notificar('E-mail ou senha inválidos.');
            } else if (codigo === 403) {
                notificar('Acesso negado.');
            } else if (codigo === 429) {
                notificar('Muitas tentativas. Tente novamente mais tarde.');
            } else {
                notificar('Não foi possível entrar. Tente novamente.');
            }
        } finally {
            envio.current = false;
            setEnviando(false);
        }
    }

    return (
        <form className="login-form" onSubmit={enviar} noValidate>
            <Input data-testid="login-email"
                id="login-email" name="email" type="email" label="E-mail"
                placeholder="nome@apae.com" autoComplete="username" autoCapitalize="none" spellCheck={false}
                required value={email} onChange={(event) => alterarCampo('email', event.target.value)}
                icon={<LoginIcon name="email" />} wrapperClassName="login-field"
                aria-invalid={Boolean(erros.email)} aria-describedby={erros.email ? 'login-email-error' : undefined}
            />
            {erros.email && <p className="login-error" id="login-email-error">{erros.email}</p>}
            <Input data-testid="login-senha"
                id="login-senha" name="senha" type={mostrarSenha ? 'text' : 'password'} label="Senha"
                placeholder="Digite sua senha" autoComplete="current-password" minLength={8}
                required value={senha} onChange={(event) => alterarCampo('senha', event.target.value)}
                icon={<LoginIcon name="lock" />} wrapperClassName="login-field"
                inputClassName="pr-12"
                aria-invalid={Boolean(erros.senha)} aria-describedby={erros.senha ? 'login-senha-error' : undefined}
                trailingAdornment={
                    <button data-testid="login-mostrar-senha" type="button" className="login-password-toggle absolute right-0 top-0 flex h-full w-12 items-center justify-center"
                        aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={mostrarSenha}
                        aria-controls="login-senha" onClick={() => setMostrarSenha((atual) => !atual)}>
                        <LoginIcon name={mostrarSenha ? 'eye-off' : 'eye'} />
                    </button>
                }
            />
            {erros.senha && <p className="login-error" id="login-senha-error">{erros.senha}</p>}
            <div className="login-options flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <button data-testid="login-recuperar-senha" type="button" className="login-recovery" onClick={() => notificar('Para redefinir sua senha, entre em contato com a administração da instituição.')}>Esqueci minha senha</button>
            </div>
            <Button data-testid="login-entrar" type="submit" className="login-submit" disabled={enviando}>
                {enviando ? 'Entrando...' : 'Entrar no sistema'}
            </Button>

        </form>
    );
}
