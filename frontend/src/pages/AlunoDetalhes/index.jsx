import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { alunoService } from '../../services/alunoService';
import { VisaoGeral } from './components/VisaoGeral';
import { Oficinas } from './components/Oficinas';
import { formatarTurno } from '../../utils/formatters';

export function AlunoDetalhes() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [aluno, setAluno] = useState(null);
    const [agenda, setAgenda] = useState([]);
    const [oficinasDisponiveis, setOficinasDisponiveis] = useState([]);
    const [refreshToken, setRefreshToken] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();

        async function carregarAluno() {
            try {
                const dados = await alunoService.buscarPorId(id, controller.signal);
                setAluno(dados);
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;

                const mensagemErro = err.response?.data?.erro || 'Não foi possível carregar os dados do aluno.';
                setError(mensagemErro);
            } finally {
                setLoading(false);
            }
        }
        carregarAluno();

        async function carregarAgenda() {
            try {
                const dados = await alunoService.buscarAgendaPorId(id, controller.signal);
                setAgenda(dados);
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;

                const mensagemErro = err.response?.data?.erro || 'Não foi possível carregar a agenda do aluno.';
                setError(mensagemErro);
            } finally {
                setLoading(false);
            }
        }
        carregarAgenda();

        async function carregarOficinasDisponiveis() {
            try {
                const dados = await alunoService.listarOficinasDisponiveis(controller.signal);
                setOficinasDisponiveis(dados);
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
                setError('Não foi possível carregar as oficinas disponíveis.');
            }
        }
        carregarOficinasDisponiveis();

        return () => controller.abort();
    }, [id, refreshToken]);

    if (loading) return <div className="p-4">Carregando dados do aluno...</div>;
    if (error) return <div className="p-4 text-red-600 bg-red-50 rounded">{error}</div>;

    const turmaRegular = agenda.find(item => item.tipo === 'REGULAR');
    const oficinas = agenda.filter(item => item.tipo === 'OFICINA');
    const quantidadeOficinas = new Set(
        oficinas.map((oficina) => oficina.turma_id ?? oficina.turma_nome),
    ).size;
    const abaAtiva = searchParams.get('aba') || 'visao-geral';

    const TABS = [
        { id: 'visao-geral', label: 'Visão Geral', count: null },
        // { id: 'atendimentos', label: 'Atendimentos', count: null },
        { id: 'oficinas', label: 'Oficinas', count: quantidadeOficinas },
        // { id: 'historico', label: 'Histórico', count: null },
    ];

    function handleTrocarAba(idAba) {
        setSearchParams({ aba: idAba });
    }

    function atualizarDados() {
        setRefreshToken((token) => token + 1);
    }

    return (
        <div className="space-y-lg">
            <div className="flex items-center gap-md">
                <button
                    onClick={() => navigate('/alunos')}
                    className="px-sm py-sm text-sm font-medium text-gray-600 bg-bg-surface border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
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
                            {turmaRegular?.turma_nome ?? 'Turma'}
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
                {abaAtiva === 'visao-geral' && <VisaoGeral dadosAluno={aluno} agenda={agenda} turmaRegular={turmaRegular} />}
                {abaAtiva === 'oficinas' && (
                    <Oficinas
                        oficinas={oficinas}
                        oficinasDisponiveis={oficinasDisponiveis}
                        turno={aluno?.turno}
                        idAluno={id}
                        onSuccess={atualizarDados}
                    />
                )}
                {/* {abaAtiva === 'atendimentos' && <AbaAtendimentos alunoId={id} />} */}
                {/* {abaAtiva === 'historico' && <AbaHistorico alunoId={id} />} */}
            </div>
        </div>
    );
}