// Mantém o padrão de ícones SVG já utilizado nos componentes do projeto.
export function LoginIcon({ name }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            {name === 'email' && <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>}
            {name === 'lock' && <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4" /></>}
            {(name === 'eye' || name === 'eye-off') && <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{name === 'eye-off' && <path d="m3 3 18 18" />}</>}
        </svg>
    );
}
