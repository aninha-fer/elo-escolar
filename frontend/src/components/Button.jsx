import { Tooltip } from './Tooltip';
import { ConteudoBotao } from './ConteudoBotao';

export function Button({ children, className = '', tooltip, loading = false, loadingLabel, disabled, ...props }) {
    const baseStyles = 'inline-flex h-[40px] w-auto shrink-0 items-center justify-center gap-sm rounded-sm bg-tertiary px-sm py-sm text-[14px] font-semibold text-bg-surface transition-colors hover:bg-tertiary/80';

    const botao = (
        <button className={`${baseStyles} ${className}`} {...props} disabled={disabled || loading} aria-busy={loading || props['aria-busy']}>
            <ConteudoBotao carregando={loading} descricao={loadingLabel}>{children}</ConteudoBotao>
        </button>
    );

    return tooltip ? <Tooltip content={tooltip} testId={props['data-testid'] ? `${props['data-testid']}-tooltip` : undefined}>{botao}</Tooltip> : botao;
}
