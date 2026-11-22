export function CardConfiguracao({ titulo, descricao, children, conteudoComPadding = true }) {
    return <section className="overflow-hidden rounded-lg border border-slate-200 bg-bg-surface shadow-sm">
        <header className="border-t-4 border-t-tertiary border-b border-b-slate-200 p-lg">
            <h2 className="text-lg font-bold text-text-main">{titulo}</h2>
            <p className="mt-xs text-sm text-text-muted">{descricao}</p>
        </header>
        <div className={conteudoComPadding ? 'p-lg' : ''}>{children}</div>
    </section>;
}
