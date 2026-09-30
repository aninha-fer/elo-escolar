export function Input({className = '', inputClassName = '', labelClassName = '', label = '', placeholder = '', type = 'text', required = false, icon = null, iconPosition = 'left', children, id, ...props}) {
    const hasLabel = Boolean(label);
    const hasIcon = Boolean(icon || children);
    const iconContent = icon ?? children;

    return (
        <div className="w-full mb-md">
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
                />
            </div>
        </div>
    );
}