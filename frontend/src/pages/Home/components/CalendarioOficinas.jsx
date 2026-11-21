import { useToast } from '../../../contexts/ToastContext';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Download, ArrowRight } from 'react-feather';
import { Button } from '../../../components/Button';
import { exportarCalendarioOficinas } from '../../../utils/exportarCalendarioOficinas';
import { OficinaCalendarioItem } from './OficinaCalendarioItem';

export function CalendarioOficinas({ dias, dataReferencia, carregando, erro, onTentarNovamente }) {
    const { notificar } = useToast();
    const [exportando, setExportando] = useState(false);
    const envio = useRef(false);
    const vazio = dias.every((dia) => !dia.oficinas.length);

    async function exportar() {
        if (envio.current || carregando || erro || vazio) return;
        envio.current = true; setExportando(true);
        try { await exportarCalendarioOficinas(dias, dataReferencia); notificar('Download preparado.', 'sucesso'); }
        catch { notificar('Não foi possível exportar o calendário. Tente novamente.'); }
        finally { envio.current = false; setExportando(false); }
    }

    return <section aria-labelledby="inicio-oficinas-titulo" aria-busy={carregando} className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-bg-surface shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-md border-b border-slate-200 px-lg py-md">
            <div className="flex min-w-0 items-center gap-md">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-amber-50 text-tertiary"><Calendar size={21} aria-hidden="true" /></span>
                <div><h2 id="inicio-oficinas-titulo" className="text-base font-bold text-text-main">Esta semana</h2><p className="mt-xs text-xs text-slate-500">Oficinas ativas</p></div>
            </div>
            <div className="flex items-center gap-md text-sm font-semibold">
                <button data-testid="inicio-exportar-oficinas" type="button" onClick={exportar} disabled={carregando || Boolean(erro) || vazio || exportando}
                    className="inline-flex items-center gap-sm rounded-sm text-slate-500 hover:text-text-main focus-visible:outline-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:opacity-40">
                    {exportando ? 'Exportando...' : 'Exportar'}<Download size={15} aria-hidden="true" />
                </button>
                <Link data-testid="inicio-ver-oficinas" to="/turmas?tipo=OFICINA" className="inline-flex items-center gap-xs rounded-sm text-blue-600 hover:underline">Ver todas<ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
        </header>
        {carregando ? <p role="status" className="p-lg text-sm text-text-muted">Carregando oficinas...</p> : erro ? <div role="alert" className="m-lg rounded-sm bg-red-50 p-md text-sm text-danger">
            <p>{erro}</p><Button data-testid="inicio-oficinas-tentar" type="button" onClick={onTentarNovamente} className="mt-sm">Tentar novamente</Button>
        </div> : <dl className="divide-y divide-slate-200 px-sm py-sm sm:px-md">
            {dias.map((dia) => <div key={dia.numero} data-testid={`inicio-oficinas-dia-${dia.numero}`} className="flex flex-col sm:flex-row">
                <dt className="shrink-0 py-sm text-xs font-bold text-text-main sm:w-15 sm:py-md">{dia.nome}</dt>
                <dd className="min-w-0 flex-1 pb-md sm:border-l sm:border-slate-200 sm:py-sm sm:pl-md">
                    {dia.oficinas.length ? <div className="flex flex-wrap gap-sm">{dia.oficinas.map((oficina) => <OficinaCalendarioItem key={oficina.chave} oficina={oficina} />)}</div>
                        : <p className="py-sm text-xs text-slate-400">Nenhuma oficina programada.</p>}
                </dd>
            </div>)}
        </dl>}
    </section>;
}
