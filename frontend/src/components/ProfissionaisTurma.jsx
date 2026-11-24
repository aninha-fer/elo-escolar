export function ProfissionaisTurma({ profissionais = [], mostrarCargo = true }) {
    if (!profissionais.length) return 'Profissional não informado';
    return <ul aria-label="Profissionais responsáveis" className="flex min-w-0 flex-col gap-sm">
        {profissionais.map((profissional) => <li key={profissional.id} className="min-w-0">
            <p className="break-words text-sm font-semibold leading-5 text-text-main">{profissional.pessoa?.nome ?? profissional.nome}</p>
            {mostrarCargo && (profissional.cargo || profissional.funcao) && <p className="break-words text-xs font-normal leading-5 text-text-muted">{profissional.cargo ?? profissional.funcao}</p>}
        </li>)}
    </ul>;
}
