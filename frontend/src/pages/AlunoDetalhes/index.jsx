import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { alunoService } from '../../services/alunoService';
import { turmasService } from '../../services/turmasService';
import { VisaoGeral } from './components/VisaoGeral';
import { Oficinas } from './components/Oficinas';
import { formatarDataHoraInstituicao, formatarTurno } from '../../utils/formatters';
import { Atendimentos } from './components/Atendimentos';

export function AlunoDetalhes() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [aluno, setAluno] = useState(null);
    const [agenda, setAgenda] = useState(null);
    const [oficinas, setOficinas] = useState([]);
    const [atendimentos, setAtendimentos] = useState([]);
    const [carregandoAgenda, setCarregandoAgenda] = useState(true);
    const [erroAgenda, setErroAgenda] = useState(null);
    const [oficinasDisponiveis, setOficinasDisponiveis] = useState([]);
    const [refreshToken, setRefreshToken] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const dataReferencia = searchParams.get('data') || '';

    useEffect(() => {
        let diaConsultado = formatarDataHoraInstituicao().slice(0, 10);
        let timer;

        function verificarMudancaDeDia() {
            clearTimeout(timer);
            const [dia, horario] = formatarDataHoraInstituicao().split('T');
            if (dia !== diaConsultado) {
                diaConsultado = dia;
                setRefreshToken((token) => token + 1);
            }
            const [horas, minutos, segundos] = horario.split(':').map(Number);
            const ateMeiaNoite = 86400000 - (horas * 3600000 + minutos * 60000 + segundos * 1000);
            timer = setTimeout(verificarMudancaDeDia, Math.min(60000, Math.ceil(ateMeiaNoite)));
        }

        verificarMudancaDeDia();
        window.addEventListener('focus', verificarMudancaDeDia);
        document.addEventListener('visibilitychange', verificarMudancaDeDia);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('focus', verificarMudancaDeDia);
            document.removeEventListener('visibilitychange', verificarMudancaDeDia);
        };
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        async function carregarAluno() {
            try {
                setLoading(true);
                setError(null);
                const [dados, inscricoes, disponiveis, atendimentosAluno] = await Promise.all([
                    alunoService.buscarPorId(id, controller.signal),
                    alunoService.buscarOficinasPorId(id, controller.signal),
                    turmasService.listarOficinasDisponiveis(controller.signal),
                    alunoService.buscarAtendimentosPorId(id, controller.signal),
                ]);
                if (controller.signal.aborted) return;
                setAluno(dados);
                setOficinas(inscricoes);
                setOficinasDisponiveis(disponiveis);
                setAtendimentos(atendimentosAluno);
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;

                const mensagemErro = err.response?.data?.erro || 'Não foi possível carregar os dados do aluno.';
                setError(mensagemErro);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        carregarAluno();

        return () => controller.abort();
    }, [id, refreshToken]);

    useEffect(() => {
        const controller = new AbortController();

        async function carregarAgenda() {
            try {
                setCarregandoAgenda(true);
                setErroAgenda(null);
                const dados = await alunoService.buscarAgendaPorId(id, controller.signal, dataReferencia);
                if (controller.signal.aborted) return;
                setAgenda(dados);
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;

                const mensagemErro = err.response?.data?.erro || 'Não foi possível carregar a agenda do aluno.';
                setErroAgenda(mensagemErro);
            } finally {
                if (!controller.signal.aborted) setCarregandoAgenda(false);
            }
        }
        carregarAgenda();

        return () => controller.abort();
    }, [id, refreshToken, dataReferencia]);

    if (loading) return <div className="p-4">Carregando dados do aluno...</div>;
    if (error) return <div className="p-4 text-red-600 bg-red-50 rounded">{error}</div>;

    const turmaRegular = aluno?.turma_regular;
    const quantidadeOficinas = new Set(oficinas.map((oficina) => oficina.turma_id)).size;
    const abaAtiva = searchParams.get('aba') || 'visao-geral';

    const TABS = [
        { id: 'visao-geral', label: 'Visão Geral', count: null },
        { id: 'oficinas', label: 'Oficinas', count: quantidadeOficinas },
        { id: 'atendimentos', label: 'Atendimentos', count: atendimentos.length },
        // { id: 'historico', label: 'Histórico', count: null },
    ];

    function handleTrocarAba(idAba) {
        setSearchParams((atuais) => {
            atuais.set('aba', idAba);
            return atuais;
        });
    }

    function selecionarSemana(data) {
        setSearchParams((atuais) => {
            if (data) atuais.set('data', data);
            else atuais.delete('data');
            return atuais;
        });
    }

    function atualizarDados() {
        setRefreshToken((token) => token + 1);
    }

    return (
        <div className="space-y-lg">
            <div className="flex items-center gap-md">
                <button
                    onClick={() => navigate('/alunos')}
                    className="px-sm py-sm text-sm font-medium text-tertiary font-semibold bg-bg-surface border border-tertiary rounded-md hover:bg-gray-50 transition-colors"
                >
                    ← Voltar
                </button>

                <div>
                    <h1 className="text-xl font-bold text-text-main">
                        {aluno?.pessoa?.nome ?? aluno?.nome ?? 'Aluno'}
                    </h1>
                    <div className="flex items-center gap-sm mt-sm">
                        <span className="inline-flex items-center gap-sm px-md py-xs rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <span className="size-1.5 rounded-full bg-emerald-500"></span>
                            {aluno?.status ?? 'Status'}
                        </span>
                        <p className="text-sm text-text-muted">
                            Período: {formatarTurno(aluno?.turno) ?? 'Turno'} <span className="mx-1">•</span>
                            {turmaRegular?.nome ?? 'Sem turma regular'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Abas de navegação">
                    {TABS.map((tab) => {
                        const isSelected = abaAtiva === tab.id;
                        return (
                            <button key={tab.id} onClick={() => handleTrocarAba(tab.id)} className={`flex items-center gap-xs py-sm px-1 border-b-2 font-semibold text-sm transition-colors ${isSelected ? 'border-secondary text-secondary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                <span>{tab.label}</span>
                                {tab.count !== null && (
                                    <span className={`text-xs rounded-full ${isSelected ? 'text-secondary' : 'bg-gray-100 text-gray-600'}`}>
                                        ({tab.count})
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div className="mt-lg">
                {abaAtiva === 'visao-geral' && (
                    <VisaoGeral dadosAluno={aluno} agenda={agenda} turmaRegular={turmaRegular}
                        dataReferencia={dataReferencia} onSelecionarSemana={selecionarSemana}
                        carregandoAgenda={carregandoAgenda} erroAgenda={erroAgenda} />
                )}
                {abaAtiva === 'oficinas' && (
                    <Oficinas
                        oficinas={oficinas}
                        oficinasDisponiveis={oficinasDisponiveis}
                        turno={aluno?.turno}
                        idAluno={id}
                        onSuccess={atualizarDados}
                    />
                )}
                {abaAtiva === 'atendimentos' && (
                    <Atendimentos atendimentos={atendimentos} idAluno={id} onSuccess={atualizarDados} />
                )}
                {/* {abaAtiva === 'historico' && <AbaHistorico alunoId={id} />} */}
            </div>
        </div>
    );
}
