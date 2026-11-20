import flor from '../../../assets/flor-inicio.png';
import { formatarDataHoraInstituicao } from '../../../utils/formatters';

export function CabecalhoInicio({ nome }) {
    const agora = formatarDataHoraInstituicao();
    const horario = Number(agora.slice(11, 13));
    const saudacao = horario >= 5 && horario < 12 ? 'Bom dia' : horario < 18 && horario >= 12 ? 'Boa tarde' : 'Boa noite';
    const data = new Date(`${agora.slice(0, 10)}T12:00:00Z`);
    const diaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(data);
    const diaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', timeZone: 'UTC' }).format(data);
    const primeiroNome = nome?.trim().split(/\s+/)[0];

    return <header className="relative isolate flex min-h-40 items-center overflow-hidden rounded-3xl bg-primary px-lg py-lg sm:min-h-44 sm:px-xl">
        <img src={flor} alt="" className="pointer-events-none absolute right-0 top-0 -z-10 h-full w-auto max-w-[52%] object-contain object-right" />
        <div className="min-w-0 max-w-[78%] sm:max-w-[75%]">
            <p className="mb-md inline-flex flex-wrap items-center gap-sm rounded-full bg-secondary/15 px-md py-sm font-mono text-[10px] uppercase tracking-widest text-secondary sm:text-xs">
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-tertiary" />{diaSemana} · {diaMes}
            </p>
            <h1 className="break-words text-2xl font-bold tracking-tight text-white sm:text-3xl">{saudacao}{primeiroNome ? `, ${primeiroNome}` : ''}.</h1>
        </div>
    </header>;
}
