import { LoginBrandPanel } from './components/LoginBrandPanel';
import { LoginForm } from './components/LoginForm';
import './login.css';

export function Login() {
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
