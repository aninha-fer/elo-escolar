import { mascararTelefone } from '../utils/formatters';

export function Input({className = '', wrapperClassName = '', inputClassName = '', labelClassName = '', label = '', placeholder = '', type = 'text', required = false, icon = null, iconPosition = 'left', trailingAdornment = null, children, id, value, onChange, ...props}) {
    const hasLabel = Boolean(label);
    const hasIcon = Boolean(icon || children);
    const iconContent = icon ?? children;

    function alterarTelefone(evento) {
        const campo = evento.target;
        const texto = campo.value;
        const anterior = mascararTelefone(value);
        let numeros = texto.replace(/\D/g, '');
        let posicao = texto.slice(0, campo.selectionStart ?? texto.length).replace(/\D/g, '').length;
        const operacao = evento.nativeEvent.inputType;
        // Ao apagar só um separador, remove também o dígito vizinho para a máscara não prendê-lo.
        if (texto !== anterior && numeros === anterior.replace(/\D/g, '') && operacao?.startsWith('delete')) {
            const indice = operacao === 'deleteContentBackward' ? posicao - 1 : posicao;
            if (indice >= 0 && indice < numeros.length) {
                numeros = numeros.slice(0, indice) + numeros.slice(indice + 1);
                if (operacao === 'deleteContentBackward') posicao--;
            }
        }
        const formatado = mascararTelefone(numeros);
        posicao = Math.min(posicao, formatado.replace(/\D/g, '').length);
        let cursor = formatado ? 1 : 0;
        for (let i = 0, digitos = 0; i < formatado.length && digitos < posicao; i++) {
            if (/\d/.test(formatado[i])) { digitos++; cursor = i + 1; }
        }
        campo.value = formatado;
        campo.setSelectionRange(cursor, cursor);
        onChange?.(evento);
    }

    return (
        <div className={`w-full mb-md ${wrapperClassName}`}>
            {hasLabel && (
                <label htmlFor={id} className={`mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600 ${labelClassName}`}>
                    {label}
                    {required && <span className="ml-1 text-red-500">*</span>}
                </label>
            )}

            <div className={`relative w-full ${className}`}>
                {hasIcon && (
                    <div
                        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                            iconPosition === 'right' ? 'right-sm' : 'left-sm'
                        }`}
                    >
                        {iconContent}
                    </div>
                )}

                <input
                    id={id}
                    type={type}
                    placeholder={placeholder}
                    required={required}
                    aria-required={required}
                    className={`flex w-full rounded-sm border border-slate-200 bg-bg-surface p-sm text-text-main placeholder:text-placeholder focus:outline-none focus:ring-1 ${
                        hasIcon && iconPosition === 'left' ? 'pl-9' : ''
                    } ${
                        hasIcon && iconPosition === 'right' ? 'pr-9' : ''
                    } ${
                        hasIcon ? '' : 'px-md'
                    } ${inputClassName}`.trim()}
                    {...props}
                    value={type === 'tel' && value !== undefined ? mascararTelefone(value) : value}
                    onChange={type === 'tel' ? alterarTelefone : onChange}
                />
                {trailingAdornment}
            </div>
        </div>
    );
}
