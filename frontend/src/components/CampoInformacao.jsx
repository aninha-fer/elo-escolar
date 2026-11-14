export function CampoInformacao({ titulo, valor }) {
    return (
        <div className="space-y-xs py-sm">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{titulo}</dt>
            <dd className="whitespace-pre-wrap break-words text-sm text-text-main">{valor ?? 'Não informado'}</dd>
        </div>
    );
}