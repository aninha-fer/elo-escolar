export function SelecaoOpcao({
    label,
    options = [],
    value,
    onChange,
    required = false,
    className = '',
    optionClassName = '',
    labelClassName = '',
    disabled = false,
    name,
}) {
    const opcoes = Array.isArray(options) ? options.slice(0, 2) : [];

    return (
        <div className={`w-full mb-md ${className}`.trim()}>
            {label && (
                <label className={`mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600 ${labelClassName}`.trim()}>
                    {label}
                    {required && <span className="ml-1 text-danger">*</span>}
                </label>
            )}

            <div className="flex w-full gap-md">
                {opcoes.map((opcao) => {
                    const isSelected = value === opcao.value;
                    const isDisabled = disabled || opcao.disabled;

                    return (
                        <button
                            key={opcao.value ?? opcao.label ?? opcao.title}
                            type="button"
                            name={name}
                            value={opcao.value}
                            onClick={() => !isDisabled && onChange?.(opcao.value)}
                            disabled={isDisabled}
                            className={`
                flex-1 rounded-sm border p-sm text-left transition-all duration-200
                ${isSelected
                                    ? 'border-secondary bg-secondary/10 text-secondary ring-1 ring-secondary/40'
                                    : 'border-slate-200 bg-bg-surface text-text-main hover:border-slate-300'}
                ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                ${optionClassName}
              `}
                            style={{
                                minHeight: 'fit-content',
                                width: '100%',
                                height: 'auto',
                            }}
                        >
                            <div className="flex py-xs items-center justify-center gap-md text-center">
                                {opcao.icon && (
                                    <span className="flex shrink-0 items-center justify-center text-base">
                                        {opcao.icon}
                                    </span>
                                )}

                                <div className="flex flex-col items-center justify-center gap-xs">
                                    <span className="block text-text-main leading-tight">
                                        {opcao.title ?? opcao.label}
                                    </span>

                                    {opcao.subtitle && (
                                        <span className="block text-[12px] leading-tight text-text-muted">
                                            {opcao.subtitle}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
