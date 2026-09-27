const DIAS_SEMANA = [
    { numero: 1, nome: 'Seg' },
    { numero: 2, nome: 'Ter' },
    { numero: 3, nome: 'Qua' },
    { numero: 4, nome: 'Qui' },
    { numero: 5, nome: 'Sex' },
];

const HORA_INICIAL = 7;
const HORA_FINAL = 17;
const ALTURA_HORA = 48;

const CORES_EVENTO = {
    REGULAR: {
        fundo: 'bg-blue-50',
        borda: 'border-blue-500',
        texto: 'text-blue-600',
    },
    OFICINA: {
        fundo: 'bg-violet-50',
        borda: 'border-violet-500',
        texto: 'text-violet-600',
    },
    ATENDIMENTO: {
        fundo: 'bg-emerald-50',
        borda: 'border-emerald-500',
        texto: 'text-emerald-600',
    },
};

function converterHora(hora) {
    if (!hora) return null;

    const [horas, minutos] = hora.split(':').map(Number);
    if (Number.isNaN(horas) || Number.isNaN(minutos)) return null;

    return horas + minutos / 60;
}

function formatarHora(hora) {
    return hora?.slice(0, 5) ?? '--:--';
}

function obterEstiloEvento(evento) {
    const inicio = converterHora(evento.hora_inicio);
    const fim = converterHora(evento.hora_fim);

    if (inicio === null || fim === null || fim <= inicio) return null;

    const inicioLimitado = Math.max(inicio, HORA_INICIAL);
    const fimLimitado = Math.min(fim, HORA_FINAL);

    if (fimLimitado <= inicioLimitado) return null;

    return {
        top: (inicioLimitado - HORA_INICIAL) * ALTURA_HORA,
        height: (fimLimitado - inicioLimitado) * ALTURA_HORA,
    };
}

function EventoAgenda({ evento }) {
    const estilo = obterEstiloEvento(evento);
    if (!estilo) return null;

    const cores = CORES_EVENTO[evento.tipo] ?? CORES_EVENTO.ATENDIMENTO;

    return (
        <div
            className={`absolute inset-x-1 overflow-hidden rounded-md border-2 px-1 py-1 ${cores.fundo} ${cores.borda} ${cores.texto}`}
            style={{ top: estilo.top, height: estilo.height }}
            title={`${evento.turma_nome} - ${formatarHora(evento.hora_inicio)} - ${formatarHora(evento.hora_fim)}`}
        >
            <p className="truncate text-xs font-bold">{evento.turma_nome}</p>
            <p className="truncate text-[10px]">
                {formatarHora(evento.hora_inicio)} - {formatarHora(evento.hora_fim)}
            </p>
        </div>
    );
}

export function CalendarioSemanal({ agenda = [] }) {
    const eventosPorDia = DIAS_SEMANA.reduce((eventos, dia) => {
        eventos[dia.numero] = agenda.filter((evento) => evento.dia_semana === dia.numero);
        return eventos;
    }, {});

    const horas = Array.from(
        { length: HORA_FINAL - HORA_INICIAL + 1 },
        (_, indice) => HORA_INICIAL + indice,
    );

    return (
        <section className="min-w-0 flex-1 overflow-hidden rounded-md border border-gray-300 bg-bg-surface">
            <header className="bg-bg-main flex flex-wrap items-center justify-between gap-sm border-b border-gray-300 px-md py-sm">
                <h2 className="text-base font-bold text-text-main">Calendário Semanal</h2>
                <div className="flex flex-wrap gap-md text-xs text-text-muted">
                    {Object.entries(CORES_EVENTO).map(([tipo, cores]) => (
                        <span key={tipo} className="inline-flex items-center gap-xs">
                            <span className={`size-3 rounded-sm border-2 ${cores.borda} ${cores.fundo}`} />
                            {tipo === 'REGULAR' ? 'Turma Regular' : tipo === 'OFICINA' ? 'Oficina' : 'Atendimento'}
                        </span>
                    ))}
                </div>
            </header>

            <div className="min-w-[416px] overflow-x-auto">
                <div className="grid grid-cols-[56px_repeat(5,minmax(72px,1fr))] border-b border-gray-300 bg-bg-main">
                    <div />
                    {DIAS_SEMANA.map((dia) => (
                        <div key={dia.numero} className="border-l border-slate-200 px-2 py-sm text-center text-sm font-bold text-text-main">
                            {dia.nome}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-[56px_repeat(5,minmax(72px,1fr))]">
                    <div>
                        {horas.slice(0, -1).map((hora) => (
                            <div key={hora} className="h-12 border-b border-slate-200 px-1 pt-2 text-right text-xs text-slate-400">
                                {String(hora).padStart(2, '0')}:00
                            </div>
                        ))}
                    </div>

                    {DIAS_SEMANA.map((dia) => (
                        <div key={dia.numero} className="relative border-l border-slate-200">
                            {horas.slice(0, -1).map((hora) => (
                                <div key={hora} className="h-12 border-b border-slate-200" />
                            ))}
                            {eventosPorDia[dia.numero].map((evento, indice) => (
                                <EventoAgenda key={`${evento.matricula_id}-${evento.dia_semana}-${indice}`} evento={evento} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {agenda.length === 0 && (
                <p className="border-t border-slate-200 px-md py-lg text-center text-sm text-text-muted">
                    Nenhum compromisso encontrado para este aluno.
                </p>
            )}
        </section>
    );
}
