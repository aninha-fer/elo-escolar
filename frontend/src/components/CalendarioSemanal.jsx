import { converterHora, formatarHora, formatarDataBR } from "../utils/formatters";

const DIAS_SEMANA = [
    { numero: 1, nome: 'Seg' },
    { numero: 2, nome: 'Ter' },
    { numero: 3, nome: 'Qua' },
    { numero: 4, nome: 'Qui' },
    { numero: 5, nome: 'Sex' },
];

const ALTURA_HORA = 48;

const CORES_EVENTO = {
    REGULAR: {
        fundo: 'bg-blue-50',
        borda: 'border-blue-500',
        texto: 'text-blue-600',
    },
    OFICINA: {
        fundo: 'bg-amber-50',
        borda: 'border-tertiary',
        texto: 'text-tertiary',
    },
    ATENDIMENTO: {
        fundo: 'bg-emerald-50',
        borda: 'border-emerald-500',
        texto: 'text-emerald-600',
    },
};

function obterEstiloEvento(evento, horaInicial) {
    const inicio = converterHora(evento.hora_inicio);
    const fim = converterHora(evento.hora_fim);

    if (inicio === null || fim === null || fim <= inicio) return null;

    return {
        top: (inicio - horaInicial) * ALTURA_HORA,
        height: (fim - inicio) * ALTURA_HORA,
    };
}

function posicionarEventos(eventos) {
    const regulares = eventos.filter((evento) => evento.tipo === 'REGULAR');
    const ordenados = eventos.filter((evento) => evento.tipo !== 'REGULAR').sort((a, b) =>
        converterHora(a.hora_inicio) - converterHora(b.hora_inicio) ||
        converterHora(b.hora_fim) - converterHora(a.hora_fim));
    const resultado = regulares.map((evento) => ({ ...evento, coluna: 0, totalColunas: 1 }));
    let grupo = [];
    let colunas = [];
    let fimGrupo = -1;
    function concluirGrupo() {
        resultado.push(...grupo.map((evento) => ({ ...evento, totalColunas: colunas.length })));
        grupo = [];
        colunas = [];
        fimGrupo = -1;
    }
    for (const evento of ordenados) {
        const inicio = converterHora(evento.hora_inicio);
        const fim = converterHora(evento.hora_fim);
        if (inicio >= fimGrupo) concluirGrupo();
        let coluna = colunas.findIndex((fimColuna) => fimColuna <= inicio);
        if (coluna === -1) coluna = colunas.length;
        colunas[coluna] = fim;
        grupo.push({ ...evento, coluna });
        fimGrupo = Math.max(fimGrupo, fim);
    }
    concluirGrupo();
    return resultado;
}

function adicionarDias(data, dias) {
    const resultado = new Date(`${data}T00:00:00.000Z`);
    resultado.setUTCDate(resultado.getUTCDate() + dias);
    return resultado.toISOString().slice(0, 10);
}

function EventoAgenda({ evento, horaInicial }) {
    const estilo = obterEstiloEvento(evento, horaInicial);
    if (!estilo) return null;

    const cores = CORES_EVENTO[evento.tipo] ?? CORES_EVENTO.ATENDIMENTO;
    const turmaRegular = evento.tipo === 'REGULAR';
    const provisorio = evento.status === 'PROVISORIO';

    return (
        <div
            className={`absolute overflow-hidden rounded-sm px-1 py-1 ${turmaRegular ? 'z-0 border' : 'z-10 border-2'} ${provisorio ? 'border-dashed' : ''} ${cores.fundo} ${cores.borda} ${cores.texto}`}
            style={{ ...estilo, left: `calc(${evento.coluna * 100 / evento.totalColunas}% + 2px)`, width: `calc(${100 / evento.totalColunas}% - 4px)` }}
            title={`${provisorio ? 'Provisório · ' : ''}${evento.titulo} - ${formatarHora(evento.hora_inicio)} - ${formatarHora(evento.hora_fim)} · ${evento.profissional}`}
        >
            <p className="truncate text-xs font-bold">{provisorio ? 'Provisório · ' : ''}{evento.titulo}</p>
            {turmaRegular && <p className="truncate text-[10px] opacity-70">Turma Regular</p>}
            <p className={`truncate text-[10px] ${turmaRegular ? 'opacity-70' : ''}`}>
                {formatarHora(evento.hora_inicio)} - {formatarHora(evento.hora_fim)}
            </p>
        </div>
    );
}

export function CalendarioSemanal({ agenda, dataReferencia, onSelecionarSemana, carregando, erro }) {
    const eventos = (agenda?.eventos ?? []).filter((evento) =>
        DIAS_SEMANA.some((dia) => dia.numero === evento.dia_semana));
    const eventosPorDia = DIAS_SEMANA.reduce((porDia, dia) => {
        porDia[dia.numero] = posicionarEventos(eventos.filter((evento) => evento.dia_semana === dia.numero));
        return porDia;
    }, {});
    const horaInicial = Math.min(7, ...eventos.map((evento) => Math.floor(converterHora(evento.hora_inicio))));
    const horaFinal = Math.max(17, ...eventos.map((evento) => Math.ceil(converterHora(evento.hora_fim))));

    const horas = Array.from(
        { length: horaFinal - horaInicial + 1 },
        (_, indice) => horaInicial + indice,
    );

    return (
        <section aria-busy={carregando} className="min-w-0 flex-1 overflow-hidden rounded-md border border-gray-300 bg-bg-surface">
            <header className="bg-bg-main flex flex-wrap items-center justify-between gap-sm border-b border-gray-300 px-md py-sm">
                <div>
                    <h2 className="text-base font-bold text-text-main">Calendário Semanal</h2>
                    {agenda && <p className="text-xs text-text-muted">{formatarDataBR(agenda.semana_inicio)} a {formatarDataBR(adicionarDias(agenda.semana_inicio, 4))}</p>}
                </div>
                <div className="flex flex-wrap gap-md text-xs text-text-muted">
                    {Object.entries(CORES_EVENTO).map(([tipo, cores]) => (
                        <span key={tipo} className="inline-flex items-center gap-xs">
                            <span className={`size-3 rounded-sm border-2 ${cores.borda} ${cores.fundo}`} />
                            {tipo === 'REGULAR' ? 'Turma Regular' : tipo === 'OFICINA' ? 'Oficina' : 'Atendimento'}
                        </span>
                    ))}
                </div>
            </header>

            <div className="flex flex-wrap items-center gap-sm border-b border-gray-300 px-md py-sm">
                <button type="button" aria-label="Semana anterior" disabled={carregando || !agenda}
                    onClick={() => onSelecionarSemana(adicionarDias(agenda.semana_inicio, -7))}
                    className="rounded-sm border border-gray-300 px-sm py-xs text-sm disabled:opacity-50">←</button>
                <button type="button" onClick={() => onSelecionarSemana('')} disabled={carregando}
                    className="rounded-sm border border-gray-300 px-sm py-xs text-sm disabled:opacity-50">Semana atual</button>
                <button type="button" aria-label="Próxima semana" disabled={carregando || !agenda}
                    onClick={() => onSelecionarSemana(adicionarDias(agenda.semana_inicio, 7))}
                    className="rounded-sm border border-gray-300 px-sm py-xs text-sm disabled:opacity-50">→</button>
                <label className="flex items-center gap-sm text-sm text-text-muted">
                    Ir para a semana de
                    <input type="date" aria-label="Data de referência da semana" disabled={carregando}
                        value={dataReferencia || agenda?.semana_inicio || ''}
                        onChange={(event) => onSelecionarSemana(event.target.value)}
                        className="rounded-sm border border-gray-300 bg-bg-surface px-sm py-xs text-text-main" />
                </label>
            </div>

            {carregando ? <p role="status" className="p-md text-sm text-text-muted">Carregando agenda...</p>
                : erro ? <p role="alert" className="p-md text-sm text-red-700">{erro}</p>
                : <div className="overflow-x-auto">
                <div className="min-w-[560px]">
                <div className="grid grid-cols-[56px_repeat(5,minmax(96px,1fr))] border-b border-gray-300 bg-bg-main">
                    <div />
                    {DIAS_SEMANA.map((dia) => (
                        <div key={dia.numero} className="border-l border-slate-200 px-2 py-sm text-center text-sm font-bold text-text-main">
                            {dia.nome}
                            {agenda && <span className="block text-xs font-normal">{formatarDataBR(adicionarDias(agenda.semana_inicio, dia.numero - 1)).slice(0, 5)}</span>}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-[56px_repeat(5,minmax(96px,1fr))]">
                    <div>
                        {horas.slice(0, -1).map((hora) => (
                            <div key={hora} className="h-12 border-b border-slate-200 px-1 pt-2 text-right text-xs text-slate-400">
                                {String(hora).padStart(2, '0')}:00
                            </div>
                        ))}
                    </div>

                    {DIAS_SEMANA.map((dia) => (
                        <div key={dia.numero} className="relative isolate border-l border-slate-200">
                            {horas.slice(0, -1).map((hora) => (
                                <div key={hora} className="h-12 border-b border-slate-200" />
                            ))}
                            {eventosPorDia[dia.numero].map((evento) => (
                                <EventoAgenda key={evento.id} evento={evento} horaInicial={horaInicial} />
                            ))}
                        </div>
                    ))}
                </div>
                </div>
            </div>}

            {!carregando && !erro && eventos.length === 0 && (
                <p className="border-t border-slate-200 px-md py-lg text-center text-sm text-text-muted">
                    Nenhum compromisso encontrado nos dias exibidos.
                </p>
            )}
        </section>
    );
}
