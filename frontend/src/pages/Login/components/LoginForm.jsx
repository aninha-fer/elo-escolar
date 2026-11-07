import { useState } from 'react';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { LoginIcon } from './LoginIcon';

export function LoginForm() {
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [mostrarSenha, setMostrarSenha] = useState(false);
    const [lembrar, setLembrar] = useState(true);
    const [erros, setErros] = useState({});
    const [aviso, setAviso] = useState('');

    function alterarCampo(campo, valor) {
        if (campo === 'email') setEmail(valor);
        else setSenha(valor);
        setErros((atuais) => ({ ...atuais, [campo]: undefined }));
        setAviso('');
    }

    function enviar(event) {
        event.preventDefault();
        const campos = event.currentTarget.elements;
        const novosErros = {};

        if (!email.trim()) novosErros.email = 'Informe seu e-mail.';
        else if (campos.email.validity.typeMismatch) novosErros.email = 'Informe um e-mail válido.';
        if (!senha) novosErros.senha = 'Informe sua senha.';
        else if (senha.length < 8) novosErros.senha = 'A senha deve ter pelo menos 8 caracteres.';

        setErros(novosErros);
        setAviso('');
        const primeiroErro = Object.keys(novosErros)[0];
        if (primeiroErro) {
            campos[primeiroErro].focus();
            return;
        }

        // Ponto de integração com o futuro fluxo de autenticação.
        setAviso('O login ainda não está disponível. Aguarde a liberação do acesso pela instituição.');
    }

    return (
        <form className="login-form" onSubmit={enviar} noValidate>
            <Input
                id="login-email" name="email" type="email" label="E-mail"
                placeholder="nome@apae.com" autoComplete="username" autoCapitalize="none" spellCheck={false}
                required value={email} onChange={(event) => alterarCampo('email', event.target.value)}
                icon={<LoginIcon name="email" />} wrapperClassName="login-field"
                aria-invalid={Boolean(erros.email)} aria-describedby={erros.email ? 'login-email-error' : undefined}
            />
            {erros.email && <p className="login-error" id="login-email-error">{erros.email}</p>}
            <Input
                id="login-senha" name="senha" type={mostrarSenha ? 'text' : 'password'} label="Senha"
                placeholder="Digite sua senha" autoComplete="current-password" minLength={8}
                required value={senha} onChange={(event) => alterarCampo('senha', event.target.value)}
                icon={<LoginIcon name="lock" />} wrapperClassName="login-field"
                inputClassName="pr-12"
                aria-invalid={Boolean(erros.senha)} aria-describedby={erros.senha ? 'login-senha-error' : undefined}
                trailingAdornment={
                    <button type="button" className="login-password-toggle absolute right-0 top-0 flex h-full w-12 items-center justify-center"
                        aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={mostrarSenha}
                        aria-controls="login-senha" onClick={() => setMostrarSenha((atual) => !atual)}>
                        <LoginIcon name={mostrarSenha ? 'eye-off' : 'eye'} />
                    </button>
                }
            />
            {erros.senha && <p className="login-error" id="login-senha-error">{erros.senha}</p>}
            <div className="login-options flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <label className="flex cursor-pointer items-center gap-2" htmlFor="login-lembrar">
                    <input id="login-lembrar" name="lembrar" type="checkbox" checked={lembrar} onChange={(event) => setLembrar(event.target.checked)} />
                    <span>Lembrar de mim</span>
                </label>
                <button type="button" className="login-recovery" onClick={() => setAviso('A recuperação de senha ainda não está disponível. Entre em contato com a administração da instituição.')}>Esqueci minha senha</button>
            </div>
            <Button type="submit" className="login-submit">Entrar no sistema</Button>
            <p className="login-notice" role="status" aria-live="polite">{aviso}</p>
        </form>
    );
}
