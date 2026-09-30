import { formatarHora, formatarTurno } from '../utils/formatters';

export function OficinaItem({ oficina, turno, modo = 'ativa', selecionada = false, onToggle }) {
    const dias = (oficina.dias ?? [])
        .sort((primeiro, segundo) => primeiro.numero - segundo.numero)
        .map((dia) => dia.nome)
        .join(', ');

    const turnoDaOficina = oficina.turno ?? turno;
    const horario = `${formatarTurno(turnoDaOficina)}: ${formatarHora(oficina.hora_inicio)} - ${formatarHora(oficina.hora_fim)}`;

    if (modo === 'selecao') {
        return (
            <li
                onClick={() => onToggle?.(oficina)}
                className={`border-t px-lg py-md first:border-t-0 cursor-pointer select-none transition-colors ${
                    selecionada
                        ? 'border-gray-300 bg-blue-50 ring-1 ring-inset ring-secondary/40'
                        : 'border-gray-300 bg-bg-surface hover:bg-black/5'
                }`}
            >
                <div className="flex items-center gap-md">
                    <div
                        aria-hidden="true"
                        className={`flex size-5 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                            selecionada
                                ? 'border-secondary bg-secondary text-white'
                                : 'border-slate-300 bg-white text-transparent'
                        }`}
                    >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                            <path d="M2.5 6.5L5.25 9L10.5 3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    <div className="min-w-0 flex-1">
                        <span className="block text-base font-bold text-text-main">
                            {oficina.turma_nome ?? oficina.nome}
                        </span>
                        <span className="block truncate text-[14px] text-text-muted">
                            {horario} {' · '}{dias}
                        </span>
                    </div>

                    <span className="shrink-0 text-sm text-text-muted">
                        {oficina.vagas_ocupadas ?? 0}/{oficina.capacidade_maxima ?? 0} vagas
                    </span>
                </div>
            </li>
        );
    }

    return (
        <li className="flex items-center justify-between gap-lg border-t border-gray-300 px-lg py-md first:border-t-0">
            <div>
                <h3 className="text-base font-bold text-text-main">{oficina.turma_nome ?? oficina.nome}</h3>
                <p className="truncate text-text-muted text-[14px]">
                    {horario}
                    {' · '}{dias}
                </p>
            </div>
            <button
                type="button"
                className="shrink-0 rounded-sm border-1 border-danger bg-danger/20 px-md py-xs text-sm font-semibold text-danger transition-colors hover:bg-danger/30"
                onClick={() => console.info('Cancelamento de oficina ainda não implementado', oficina.turma_id)}
            >
                Cancelar inscrição
            </button>
        </li>
    );
}