import apaeLogo from '../../../assets/apae.png';

export function LoginBrandPanel() {
    return (
        <aside className="login-brand relative flex min-w-0 flex-col overflow-hidden bg-primary text-white" aria-label="Elo Escolar — APAE">
            <div className="login-brand-ring" aria-hidden="true" />
            <div className="login-brand-dot" aria-hidden="true" />
            <div className="login-brand-identity relative flex items-center gap-3">
                <div className="login-logo flex shrink-0 items-center justify-center bg-bg-surface">
                    <img src={apaeLogo} alt="APAE" className="size-10 object-contain" />
                </div>
                <div>
                    <p className="text-base font-extrabold text-secondary">Elo Escolar</p>
                    <p className="login-brand-caption">APAE · GESTÃO EDUCACIONAL</p>
                </div>
            </div>
            <div className="login-brand-copy relative">
                <p className="login-eyebrow text-tertiary">GESTÃO ESCOLAR APAE</p>
                <h2>Cuidado e organização<br className="login-desktop-break" /> em um só lugar.</h2>
            </div>
            <p className="login-brand-footer relative">ELO ESCOLAR · APAE</p>
        </aside>
    );
}
