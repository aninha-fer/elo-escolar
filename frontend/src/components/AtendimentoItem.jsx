import { formatarDataBR, formatarFrequencia, formatarHora } from '../utils/formatters';

export function AtendimentoItem({ atendimento, onCancelar, cancelando = false }) {
    const semanal = atendimento.tipo_recorrencia === 'SEMANAL';
    const mensal = atendimento.tipo_recorrencia === 'MENSAL';
    const frequencia = atendimento.frequencia ?? 1;
    const recorrencia = semanal
        ? frequencia === 1 ? 'Semanal' : `A cada ${frequencia} semanas`
        : mensal ? frequencia === 1 ? 'Mensal' : `A cada ${frequencia} meses` : 'Pontual';
    const dias = semanal ? formatarFrequencia([...(atendimento.dias_semana ?? [])].sort((a, b) => a - b)) : '';
    const horaInicio = atendimento.hora_inicio?.split('T').pop();
    const periodo = semanal || mensal
        ? `${formatarDataBR(atendimento.data_inicio)}${atendimento.data_termino
            ? ` até ${formatarDataBR(atendimento.data_termino)}` : ' · Sem data de término'}`
        : formatarDataBR(atendimento.data_inicio);

    return (
        <li className="flex flex-wrap items-center justify-between gap-md border-t border-gray-300 px-lg py-md first:border-t-0">
            <div className="min-w-0 space-y-xs">
                <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-text-main">{atendimento.modalidade}</h3>
                    <p className="text-tertiary bg-tertiary/20 rounded-lg py-xs px-sm border text-xs">{recorrencia}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-text-muted text-[14px] ">
                        👤 {atendimento.profissional?.pessoa?.nome ?? 'Profissional não informado'}
                    </p>
                    <p className="text-text-muted text-[14px]">
                        🕐 {formatarHora(horaInicio)} · {atendimento.duracao_minutos} min {dias ? ` · ${dias}` : ''}
                    </p>
                    <p className="text-text-muted text-[14px]">
                        📅 {periodo}
                    </p>
                </div>
            </div>
            {onCancelar && <button
                type="button"
                className="shrink-0 rounded-sm border-1 border-danger bg-danger/20 px-md py-xs text-sm font-semibold text-danger transition-colors hover:bg-danger/30 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={cancelando || !onCancelar}
                onClick={() => onCancelar?.(atendimento)}
            >
                Cancelar atendimento
            </button>}
        </li>
    );
}
