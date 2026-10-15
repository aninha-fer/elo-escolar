import { useId } from "react";

export function Toggle({
    label = '',
    required = false,
    disabled = false,
    checked = false,
    onChange,
    name = 'participa_almoco',
    id,
}) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const labelId = `${inputId}-label`;

    return (
        <div className="mb-md">
            <span id={labelId} className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                {label}
                {required && <span className="ml-1 text-red-500">*</span>}
            </span>
            <div className="flex items-center gap-sm">
                <input
                    id={inputId}
                    name={name}
                    type="checkbox"
                    role="switch"
                    checked={checked}
                    disabled={disabled}
                    onChange={(event) => onChange?.(event.target.checked)}
                    aria-labelledby={labelId}
                    className="peer sr-only"
                />
                <label
                    htmlFor={inputId}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-600 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-600 peer-focus-visible:ring-offset-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                >
                    <span className={`absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
                </label>
                <span aria-hidden="true" className="text-sm text-text-main">
                    {checked ? 'Sim' : 'Não'}
                </span>
            </div>
        </div>
    );
}