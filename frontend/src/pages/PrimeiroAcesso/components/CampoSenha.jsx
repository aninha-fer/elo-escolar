import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'react-feather';
import { Input } from '../../../components/Input';

export function CampoSenha({ id, label, valor, onChange, erro, autoFocus }) {
    const [visivel, setVisivel] = useState(false);
    return <div>
        <Input id={id} name={id} data-testid={id} label={label} required autoFocus={autoFocus}
            type={visivel ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={100}
            placeholder={id === 'nova_senha' ? 'Digite a nova senha' : 'Repita a nova senha'} value={valor} onChange={onChange}
            icon={<Lock size={18} />} inputClassName="pr-12" labelClassName="font-mono"
            aria-invalid={Boolean(erro)} aria-describedby={erro ? `${id}-erro` : undefined}
            trailingAdornment={<button type="button" data-testid={`${id}-mostrar`} aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={visivel} aria-controls={id} onClick={() => setVisivel((atual) => !atual)}
                className="absolute right-0 top-0 flex h-full w-12 items-center justify-center rounded-sm text-text-muted">
                {visivel ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>} />
        {erro && <p id={`${id}-erro`} className="mb-md text-sm text-red-700">{erro}</p>}
    </div>;
}
