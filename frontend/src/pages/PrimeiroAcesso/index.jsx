import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Check, Key, Mail } from 'react-feather';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../../components/Modal';
import { CampoSenha } from './components/CampoSenha';

const requisitos = [
    { texto: 'De 8 a 100 caracteres', validar: (senha) => senha.length >= 8 && senha.length <= 100 },
    { texto: 'Uma letra maiúscula', validar: (senha) => /[A-Z]/.test(senha) },
    { texto: 'Uma letra minúscula', validar: (senha) => /[a-z]/.test(senha) },
    { texto: 'Um número', validar: (senha) => /[0-9]/.test(senha) },
];

export function PrimeiroAcesso() {
    const { usuario, trocarSenhaInicial } = useAuth();
    const navigate = useNavigate();
    const [formulario, setFormulario] = useState({ nova_senha: '', confirmacao_senha: '' });
    const [erros, setErros] = useState({});
    const [erroEnvio, setErroEnvio] = useState('');
    const [enviando, setEnviando] = useState(false);
    const envio = useRef(false);
    const valido = requisitos.every((item) => item.validar(formulario.nova_senha)) && formulario.nova_senha === formulario.confirmacao_senha;

    function atualizar(campo, valor) {
        setFormulario((atual) => ({ ...atual, [campo]: valor }));
        setErros({}); setErroEnvio('');
    }

    async function enviar(event) {
        event.preventDefault();
        if (envio.current || !valido) return;
        envio.current = true; setEnviando(true); setErroEnvio('');
        try {
            await trocarSenhaInicial(formulario);
            setFormulario({ nova_senha: '', confirmacao_senha: '' });
            navigate('/', { replace: true });
        } catch (error) {
            setErros(Object.fromEntries((error.response?.data?.erros ?? []).map((item) => [item.campo, item.mensagem])));
            setErroEnvio(error.response?.data?.erro || 'Não foi possível alterar a senha. Tente novamente.');
            if (error.response?.status === 401) {
                setFormulario({ nova_senha: '', confirmacao_senha: '' });
                navigate('/login', { replace: true, state: { aviso: error.response?.data?.erro } });
            }
        } finally { envio.current = false; setEnviando(false); }
    }

    if (!usuario?.deve_trocar_senha) return <Navigate to="/" replace />;
    const divergente = formulario.confirmacao_senha && formulario.nova_senha !== formulario.confirmacao_senha;
    return <main className="min-h-dvh bg-bg-main">
        <Modal isOpen dismissible={false} showHeader={false} testId="primeiro-acesso" ariaLabelledBy="primeiro-acesso-titulo"
            confirmText="Salvar nova senha ✓" confirmFormId="form-primeiro-acesso" onConfirm={enviar} isConfirmLoading={enviando} isConfirmDisabled={!valido}>
            <header className="-mx-5 -mt-5 mb-lg flex items-center gap-md border-b border-blue-100 bg-blue-50 p-5">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-secondary text-white"><Key size={27} /></span>
                <div><p className="font-mono text-xs tracking-widest text-secondary">PRIMEIRO ACESSO</p>
                    <h1 id="primeiro-acesso-titulo" className="mt-xs text-xl font-bold text-text-main">Crie uma nova senha</h1>
                    <p className="mt-xs text-sm text-text-muted">Para sua segurança, substitua a senha temporária antes de continuar.</p></div>
            </header>
            <p className="mb-lg flex items-center gap-sm break-all rounded-md bg-bg-main p-md text-sm text-text-muted"><Mail size={18} className="shrink-0" />{usuario.email}</p>
            <form id="form-primeiro-acesso" onSubmit={enviar} noValidate>
                <fieldset disabled={enviando} className="min-w-0">
                    <CampoSenha id="nova_senha" label="Nova senha" valor={formulario.nova_senha} autoFocus onChange={(event) => atualizar('nova_senha', event.target.value)} erro={erros.nova_senha} />
                    <CampoSenha id="confirmacao_senha" label="Confirmar nova senha" valor={formulario.confirmacao_senha} onChange={(event) => atualizar('confirmacao_senha', event.target.value)} erro={erros.confirmacao_senha || (divergente ? 'A confirmação deve ser igual à nova senha.' : '')} />
                    <ul className="grid grid-cols-1 gap-sm rounded-md bg-bg-main p-md text-sm sm:grid-cols-2">
                        {requisitos.map((item) => <li key={item.texto} className={`flex items-center gap-sm ${item.validar(formulario.nova_senha) ? 'text-emerald-700' : 'text-text-muted'}`}>
                            <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-200">{item.validar(formulario.nova_senha) ? <Check size={13} /> : '•'}</span>{item.texto}
                        </li>)}
                    </ul>
                    {erroEnvio && <p role="alert" className="mt-md rounded-sm bg-red-50 p-sm text-sm text-red-700">{erroEnvio}</p>}
                </fieldset>
            </form>
        </Modal>
    </main>;
}
