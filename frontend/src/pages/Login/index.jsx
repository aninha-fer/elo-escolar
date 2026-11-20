import { LoginBrandPanel } from './components/LoginBrandPanel';
import { LoginForm } from './components/LoginForm';
import './login.css';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function Login() {
    const { status, usuario } = useAuth();
    if (status === 'autenticado') return <Navigate to={usuario.deve_trocar_senha ? '/primeiro-acesso' : '/'} replace />;
    return (
        <main className="login-page grid min-h-dvh bg-bg-main font-sans">
            <LoginBrandPanel />
            <section className="login-content relative flex min-w-0 items-center justify-center" aria-labelledby="login-title">
                <div className="login-form-container w-full">
                    <header className="login-heading">
                        <p className="login-eyebrow">BEM-VINDO</p>
                        <h1 id="login-title">Acesse sua conta</h1>
                    </header>
                    <LoginForm />
                </div>
            </section>
        </main>
    );
}
