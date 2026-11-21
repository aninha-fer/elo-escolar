export function CampoInformacao({ titulo, valor, className = 'space-y-xs py-sm',
    tituloClassName = 'text-[10px] font-semibold uppercase tracking-wider text-text-muted',
    valorClassName = 'whitespace-pre-wrap break-words text-sm text-text-main' }) {
    return (
        <div className={className}>
            <dt className={tituloClassName}>{titulo}</dt>
            <dd className={valorClassName}>{valor ?? 'Não informado'}</dd>
        </div>
    );
}
