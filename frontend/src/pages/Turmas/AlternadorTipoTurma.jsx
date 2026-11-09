const opcoes = [
    { value: 'REGULAR', label: 'Turmas Regulares' },
    { value: 'OFICINA', label: 'Oficinas' },
];

export function AlternadorTipoTurma({ value, onChange }) {
    return (
        <div role="group" aria-label="Tipo de turma" className="inline-flex w-fit max-w-full rounded-md border-2 border-slate-200 bg-bg-main p-xs">
            {opcoes.map((opcao) => {
                const selecionado = value === opcao.value;
                return (
                    <button
                        key={opcao.value}
                        type="button"
                        aria-pressed={selecionado}
                        onClick={() => onChange(opcao.value)}
                        className={`min-h-10 rounded-sm px-5 py-sm text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 ${selecionado
                            ? 'bg-bg-surface font-semibold text-text-main shadow-sm ring-1 ring-slate-200'
                            : 'text-slate-500 hover:bg-bg-surface/50 hover:text-text-main'}`}
                    >
                        {opcao.label}
                    </button>
                );
            })}
        </div>
    );
}
