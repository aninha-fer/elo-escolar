export function ProfissionaisTurma({ profissionais = [], mostrarCargo = false }) {
    if (!profissionais.length) return 'Profissional não informado';
    return <ul aria-label="Profissionais responsáveis" className="flex flex-wrap gap-sm">
        {profissionais.map((profissional) => <li key={profissional.id}
            className="inline-flex max-w-full items-center rounded-full bg-amber-50 px-sm py-xs text-xs font-semibold text-amber-600">
            <span className="min-w-0 break-words">{profissional.pessoa?.nome ?? profissional.nome}
                {mostrarCargo && profissional.cargo && <span className="font-normal"> · {profissional.cargo}</span>}
            </span>
        </li>)}
    </ul>;
}
