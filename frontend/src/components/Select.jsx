import { useId } from 'react';
import { Spinner } from './Spinner';

export function Select({
    id,
    label = '',
    options = [],
    placeholder = '— Selecionar —',
    required = false,
    disabled = false,
    loading = false,
    loadingLabel = 'Carregando opções...',
    error = '',
    className = '',
    labelClassName = '',
    selectClassName = '',
    ...props
}) {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const errorId = `${selectId}-error`;

    return (
        <div className={`mb-md w-full ${className}`.trim()}>
            {label && (
                <label
                    htmlFor={selectId}
                    className={`mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600 ${labelClassName}`.trim()}
                >
                    {label}
                    {required && <span className="ml-1 text-red-500">*</span>}
                </label>
            )}

            <div className="relative">
            <select
                id={selectId}
                required={required}
                disabled={disabled || loading}
                aria-busy={loading}
                aria-required={required}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                className={`w-full rounded-sm border bg-bg-surface px-md py-sm text-text-main focus:outline-none focus:ring-1 focus:ring-secondary disabled:cursor-not-allowed disabled:opacity-50 ${
                    error ? 'border-red-500' : 'border-slate-200'
                } ${loading ? 'appearance-none pr-10' : ''} ${selectClassName}`.trim()}
                {...props}
            >
                <option value="" disabled={required}>
                    {placeholder}
                </option>
                {options.map((option) => (
                    <option
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                    >
                        {option.label ?? option.title}
                    </option>
                ))}
            </select>
            {loading && <span className="pointer-events-none absolute inset-y-0 right-sm flex items-center text-text-muted"><Spinner label={loadingLabel} /></span>}
            </div>

            {error && (
                <p id={errorId} className="mt-1 text-sm text-red-600">
                    {error}
                </p>
            )}
        </div>
    );
}
