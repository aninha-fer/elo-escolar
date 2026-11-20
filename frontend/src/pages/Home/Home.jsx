import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useListagemInfinita } from '../../hooks/useListagemInfinita';
import { turmasService } from '../../services/turmasService';
import { hojeInstituicao } from '../../utils/anoLetivo';
import { agruparOficinasPorDia } from '../../utils/calendarioOficinas';
import { CabecalhoInicio } from './components/CabecalhoInicio';
import { CalendarioOficinas } from './components/CalendarioOficinas';
import { ListaTurmasAtivas } from './components/ListaTurmasAtivas';

export function Home() {
    const { usuario } = useAuth();
    const [versao, setVersao] = useState(0);
    const [oficinas, setOficinas] = useState(null);
    const hoje = hojeInstituicao();
    const ano = Number(hoje.slice(0, 4));
    const listagem = useListagemInfinita(turmasService.listarPaginadas, { tipo: 'REGULAR', status: 'ATIVO', ano }, versao);

    useEffect(() => {
        const controller = new AbortController();
        async function carregar() {
            try {
                const dados = await turmasService.listarOficinasAtivas(controller.signal);
                if (!controller.signal.aborted) setOficinas({ versao, dados });
            } catch (error) {
                if (!controller.signal.aborted) setOficinas({ versao, dados: [], erro: error.response?.data?.erro || 'Não foi possível carregar as oficinas.' });
            }
        }
        carregar();
        return () => controller.abort();
    }, [versao]);

    useEffect(() => {
        function atualizarAoRetornar() { if (document.visibilityState === 'visible') setVersao((v) => v + 1); }
        window.addEventListener('focus', atualizarAoRetornar);
        document.addEventListener('visibilitychange', atualizarAoRetornar);
        return () => { window.removeEventListener('focus', atualizarAoRetornar); document.removeEventListener('visibilitychange', atualizarAoRetornar); };
    }, []);

    const atuais = oficinas?.versao === versao ? oficinas : null;
    const dias = agruparOficinasPorDia(atuais?.dados ?? []);
    return <div className="flex min-w-0 flex-col gap-lg">
        <CabecalhoInicio nome={usuario?.nome} />
        <div className="grid min-w-0 grid-cols-1 items-start gap-lg xl:grid-cols-[minmax(0,2.4fr)_minmax(260px,1fr)] xl:items-stretch">
            <CalendarioOficinas dias={dias} dataReferencia={hoje} carregando={!atuais} erro={atuais?.erro} onTentarNovamente={() => setVersao((v) => v + 1)} />
            <div className="min-w-0 xl:relative">
                <ListaTurmasAtivas listagem={listagem} ano={ano} />
            </div>
        </div>
    </div>;
}
