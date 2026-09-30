const SPAN_STYLES = {
    TODOS: 'bg-secondary/10 text-secondary',
    ATIVO: 'bg-emerald-50 text-emerald-600',
    INATIVO: 'bg-slate-100 text-slate-600',
    RASCUNHO: 'bg-amber-100 text-tertiary',
};

const BUTTON_ACTIVE_STYLES = {
    TODOS: 'bg-secondary/10 border-secondary',
    ATIVO: 'bg-emerald-50 border-emerald-600',
    INATIVO: 'bg-slate-100 border-slate-600',
    RASCUNHO: 'bg-amber-100 border-tertiary',
};

const BUTTON_DEFAULT_STYLE = 'bg-bg-surface border-slate-200 hover:border-slate-300';

export function FiltroEstado({ children, count, tipo, isSelecionado, className = '', ...props }) {

    const buttonVariantClass = isSelecionado
        ? BUTTON_ACTIVE_STYLES[tipo]
        : BUTTON_DEFAULT_STYLE;

    const baseStyles = 'flex h-18 w-full min-w-0 items-center justify-start gap-4 rounded-sm border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:flex-1';

    return (
        <button type="button" className={`${baseStyles} ${buttonVariantClass} ${className}`} {...props}>
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-sm text-[20px] font-bold ${SPAN_STYLES[tipo]}`}>
                {count}
            </span>
            <span className="text-[14px] font-semibold text-text-main">
                {children}
            </span>
        </button>
    );
}
