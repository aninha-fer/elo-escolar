import { formatarDataBR, formatarFrequencia, formatarHora, formatarDataHoraInstituicao } from '../utils/formatters';
import { BotaoAcoes } from './BotaoAcoes';
import EditIcon from './icons/EditIcon';

export function AtendimentoItem({ atendimento, onEditar, onCancelar, cancelando = false }) {
    const semanal = atendimento.tipo_recorrencia === 'SEMANAL';
    const mensal = atendimento.tipo_recorrencia === 'MENSAL';
    const frequencia = atendimento.frequencia ?? 1;
    const recorrencia = semanal
        ? frequencia === 1 ? 'Semanal' : `A cada ${frequencia} semanas`
        : mensal ? frequencia === 1 ? 'Mensal' : `A cada ${frequencia} meses` : 'Pontual';
    const dias = semanal ? formatarFrequencia([...(atendimento.dias_semana ?? [])].sort((a, b) => a - b)) : '';
    const horaInicio = atendimento.hora_inicio?.split('T').pop();
    const eventualIniciado = atendimento.tipo_recorrencia === 'EVENTUAL' &&
        `${atendimento.data_inicio?.slice(0, 10)}T${atendimento.hora_inicio?.slice(11, 19)}.000` <= formatarDataHoraInstituicao(new Date());
    const periodo = semanal || mensal
        ? `${formatarDataBR(atendimento.data_inicio)}${atendimento.data_termino
            ? ` até ${formatarDataBR(atendimento.data_termino)}` : ' · Sem data de término'}`
        : formatarDataBR(atendimento.data_inicio);

    return (
        <li className="flex flex-wrap items-center justify-between gap-md border-t border-gray-300 px-lg py-md first:border-t-0">
            <div className="min-w-0 space-y-xs">
                <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-text-main">{atendimento.modalidade}</h3>
                    {atendimento.status === 'PROVISORIO' && <span className="text-xs text-text-muted">Provisório</span>}
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
                        📅 {semanal || mensal ? 'Início planejado: ' : ''}{periodo}
                    </p>
                </div>
                {mensal && <p className="text-xs text-text-muted">Confira na agenda as datas de cada sessão mensal.</p>}
            </div>
            {(onEditar || onCancelar) && <BotaoAcoes label={`Ações para ${atendimento.modalidade}`} disabled={cancelando} options={[
                { id: 'editar', label: 'Editar', disabled: !onEditar || eventualIniciado,
                    icon: <EditIcon />, onClick: () => onEditar?.(atendimento) },
                { id: 'cancelar', label: 'Cancelar', disabled: !onCancelar, textColor: '#DC2626',
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M6 18 18 6" /></svg>, onClick: () => onCancelar?.(atendimento) },
            ]} />}
        </li>
    );
}
