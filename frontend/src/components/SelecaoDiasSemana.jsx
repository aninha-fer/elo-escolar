export function SelecaoDiasSemana({
    label,
    value = [],
    onChange,
    required = false,
    className = '',
    containerClassName = '',
    optionClassName = '',
    labelClassName = '',
    disabled = false,
    name,
    options = [],
    allowSelectAll = true,
    selectAllLabel = 'Todos',
}) {
    const opcoesPadrao = [
        { value: 'SEG', label: 'Seg' },
        { value: 'TER', label: 'Ter' },
        { value: 'QUA', label: 'Qua' },
        { value: 'QUI', label: 'Qui' },
        { value: 'SEX', label: 'Sex' },
        { value: 'TODOS', label: selectAllLabel },
    ];

    const opcoes = options.length > 0 ? options : opcoesPadrao;
    const valoresSelecionados = Array.isArray(value) ? value : [];

    function alternarSelecao(opcaoValue) {
        if (disabled) return;

        if (opcaoValue === 'TODOS' || opcaoValue === 'ALL') {
            const todosSelecionados = valoresSelecionados.includes('TODOS') || valoresSelecionados.includes('ALL');
            const proximo = todosSelecionados
                ? opcoes
                    .filter((opcao) => opcao.value !== 'TODOS' && opcao.value !== 'ALL')
                    .map((opcao) => opcao.value)
                : opcoes
                    .filter((opcao) => opcao.value !== 'TODOS' && opcao.value !== 'ALL')
                    .map((opcao) => opcao.value);

            onChange?.(proximo);
            return;
        }

        let novoValor;

        if (valoresSelecionados.includes(opcaoValue)) {
            novoValor = valoresSelecionados.filter((item) => item !== opcaoValue);
        } else {
            novoValor = [...valoresSelecionados, opcaoValue];
        }

        onChange?.(novoValor);
    }

    function isSelected(opcaoValue) {
        if (opcaoValue === 'TODOS' || opcaoValue === 'ALL') {
            return opcoes
                .filter((opcao) => opcao.value !== 'TODOS' && opcao.value !== 'ALL')
                .every((opcao) => valoresSelecionados.includes(opcao.value));
        }

        return valoresSelecionados.includes(opcaoValue);
    }

    return (
        <div className={`w-full mb-md ${className}`.trim()}>
            {label && (
                <label className={`mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600 ${labelClassName}`.trim()}>
                    {label}
                    {required && <span className="ml-1 text-danger">*</span>}
                </label>
            )}

            <div className={`flex w-full flex-wrap gap-md ${containerClassName}`.trim()}>
                {opcoes.map((opcao) => {
                    const selecionado = isSelected(opcao.value);
                    const isTodos = opcao.value === 'TODOS' || opcao.value === 'ALL';

                    return (
                        <button
                            key={opcao.value ?? opcao.label}
                            type="button"
                            name={name}
                            aria-pressed={selecionado}
                            disabled={disabled}
                            onClick={() => alternarSelecao(opcao.value)}
                            className={`
                                flex-1 rounded-full border px-sm py-xs text-center text-sm font-medium transition-all duration-200
                                ${selecionado
                                    ? 'border-secondary bg-secondary/10 text-secondary ring-1 ring-secondary/40'
                                    : 'border-secondary bg-bg-surface text-secondary hover:border-secondary/80'}
                                ${isTodos && !selecionado ? 'border-dashed' : ''}
                                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                                ${optionClassName}
                            `.trim()}
                            style={{
                                minHeight: 'fit-content',
                                height: 'auto',
                                paddingInline: '12px',
                            }}
                        >
                            {opcao.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
