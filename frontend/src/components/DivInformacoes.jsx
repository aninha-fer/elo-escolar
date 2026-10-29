export function DivInformacoes({ children, titulo = 'Informações', destaque }) {
    return(
        <div className="flex w-full flex-col rounded-md border border-gray-300 bg-bg-surface p-md">
            <div className="mb-md flex w-full items-center justify-between gap-sm border-b border-gray-300 py-sm">
                <h3 className="text-sm font-bold">{titulo}</h3>
                {destaque}
            </div>
            {children}
        </div>
    )
}
