import { useToast } from '../../contexts/ToastContext';
import { useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useListagemInfinita } from '../../hooks/useListagemInfinita';
import { CarregarMais } from '../../components/CarregarMais';
import { alunoService } from '../../services/alunoService';
import { turmasService } from '../../services/turmasService';
import { VisaoGeral } from './components/VisaoGeral';
import { Oficinas } from './components/Oficinas';
import { formatarDataHoraInstituicao, formatarTurno } from '../../utils/formatters';
import { Atendimentos } from './components/Atendimentos';
import { useAuth } from '../../contexts/AuthContext';
import { BotaoVoltar } from '../../components/BotaoVoltar';
import { FormularioAluno } from '../Alunos/FormularioAluno';
import { Ocorrencias } from './components/Ocorrencias';
import { ocorrenciasService } from '../../services/ocorrenciasService';
import { BotaoExportarCalendario } from '../../components/BotaoExportarCalendario';
import { CarregamentoCentralizado } from '../../components/CarregamentoCentralizado';

const estilosStatus = {
    ATIVO: 'bg-emerald-50 text-emerald-600 before:bg-emerald-600',
    INATIVO: 'bg-slate-100 text-slate-500 before:bg-slate-400',
    RASCUNHO: 'bg-amber-50 text-amber-600 before:bg-amber-500',
};

const carregarOficinas = ({ id, ...params }, signal) => alunoService.buscarOficinasPorId(id, signal, params);
const carregarAtendimentos = ({ id, ...params }, signal) => alunoService.buscarAtendimentosPorId(id, signal, params);
const carregarOcorrencias = ({ id, ...params }, signal) => ocorrenciasService.listar(id, signal, params);

export function AlunoDetalhes() {
    const { notificar } = useToast();
    const { id } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const [aluno, setAluno] = useState(null);
    const [agenda, setAgenda] = useState(null);
    const [versaoOcorrencias, setVersaoOcorrencias] = useState(0);
    const [carregandoAgenda, setCarregandoAgenda] = useState(true);
    const [erroAgenda, setErroAgenda] = useState(null);
    const [oficinasDisponiveis, setOficinasDisponiveis] = useState([]);
    const [refreshToken, setRefreshToken] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [alunoEdicao, setAlunoEdicao] = useState(null);
    const [carregandoEdicao, setCarregandoEdicao] = useState(false);
    const edicaoController = useRef(null);
    const dataReferencia = searchParams.get('data') || '';
    const { usuario } = useAuth();
    const podeEditar = usuario?.role === 'admin';

    useEffect(() => () => edicaoController.current?.abort(), [id]);

    const listaOficinas = useListagemInfinita(carregarOficinas, { id }, refreshToken);
    const listaAtendimentos = useListagemInfinita(carregarAtendimentos, { id }, refreshToken);
    const listaOcorrencias = useListagemInfinita(carregarOcorrencias, { id }, `${refreshToken}:${versaoOcorrencias}`);

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
                const [dados, disponiveis] = await Promise.all([
                    alunoService.buscarPorId(id, controller.signal),
                    turmasService.listarOficinasAtivas(controller.signal),
                ]);
                if (controller.signal.aborted) return;
                setAluno(dados);
                setOficinasDisponiveis(disponiveis);
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

    if (loading) return <div className="flex min-h-full flex-col"><CarregamentoCentralizado label="Carregando dados do aluno..." /></div>;
    if (error) return <div className="p-4 text-red-600 bg-red-50 rounded">{error}</div>;

    const turmaRegular = aluno?.turma_regular;
    const abaAtiva = searchParams.get('aba') || 'visao-geral';

    const TABS = [
        { id: 'visao-geral', label: 'Visão Geral', count: null },
        { id: 'oficinas', label: 'Oficinas', count: listaOficinas.carregando || listaOficinas.erro ? null : listaOficinas.total },
        { id: 'atendimentos', label: 'Atendimentos', count: listaAtendimentos.carregando || listaAtendimentos.erro ? null : listaAtendimentos.total },
        { id: 'ocorrencias', label: 'Ocorrências', count: listaOcorrencias.carregando || listaOcorrencias.erro ? null : listaOcorrencias.total },
        // { id: 'historico', label: 'Histórico', count: null },
    ];

    function handleTrocarAba(idAba) {
        setSearchParams((atuais) => {
            atuais.set('aba', idAba);
            return atuais;
        }, { replace: true });
    }

    function selecionarSemana(data) {
        setSearchParams((atuais) => {
            if (data) atuais.set('data', data);
            else atuais.delete('data');
            return atuais;
        }, { replace: true });
    }

    function atualizarDados() {
        setRefreshToken((token) => token + 1);
    }

    async function abrirEdicao() {
        if (!podeEditar || edicaoController.current) return;
        const controller = new AbortController();
        edicaoController.current = controller;
        setCarregandoEdicao(true);
        try {
            const dados = await alunoService.buscarPorId(id, controller.signal);
            if (!controller.signal.aborted) setAlunoEdicao(dados);
        } catch (err) {
            if (!controller.signal.aborted) notificar(err.response?.data?.erro || 'Não foi possível carregar o aluno para edição. Tente novamente.');
        } finally {
            if (edicaoController.current === controller) {
                edicaoController.current = null;
                setCarregandoEdicao(false);
            }
        }
    }

    function alunoSalvo() {
        setAlunoEdicao(null);
        atualizarDados();
    }

    return (
        <div className="space-y-lg">
            <div className="flex flex-wrap items-center gap-md">
                <BotaoVoltar data-testid="aluno-voltar" to='/alunos' />
                <div>
                    <h1 className="text-xl font-bold text-text-main">
                        {aluno?.pessoa?.nome ?? aluno?.nome ?? 'Aluno'}
                    </h1>
                    <div className="flex items-center gap-sm mt-sm">
                        <span className={`inline-flex items-center gap-sm px-md py-xs rounded-full text-xs font-semibold before:size-1.5 before:shrink-0 before:rounded-full ${estilosStatus[aluno?.status] ?? estilosStatus.RASCUNHO}`}>
                            {aluno?.status ?? 'Status'}
                        </span>
                        <p className="text-sm text-text-muted">
                            Período: {formatarTurno(aluno?.turno) ?? 'Turno'} <span className="mx-1">•</span>
                            {turmaRegular ? `${turmaRegular.nome}${turmaRegular.status === 'INATIVO' ? ' — Inativa' : ''}` : 'Sem turma regular'}
                        </p>
                    </div>
                </div>
                <BotaoExportarCalendario alunoId={id} disabled={!aluno} className="ml-auto" testId="aluno-exportar-calendario" />
            </div>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Abas de navegação">
                    {TABS.map((tab) => {
                        const isSelected = abaAtiva === tab.id;
                        return (
                            <button data-testid={`aluno-aba-${tab.id}`} key={tab.id} onClick={() => handleTrocarAba(tab.id)} className={`flex items-center gap-xs py-sm px-1 border-b-2 font-semibold text-sm transition-colors ${isSelected ? 'border-secondary text-secondary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
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
                    <VisaoGeral
                        dadosAluno={aluno}
                        agenda={agenda}
                        turmaRegular={turmaRegular}
                        dataReferencia={dataReferencia}
                        onSelecionarSemana={selecionarSemana}
                        carregandoAgenda={carregandoAgenda}
                        erroAgenda={erroAgenda}
                        permissao={podeEditar}
                        onEditar={abrirEdicao}
                        carregandoEdicao={carregandoEdicao}
                    />
                )}
                {abaAtiva === 'oficinas' && (
                    <>
                    {!listaOficinas.carregando && !listaOficinas.erro && <Oficinas
                        oficinas={listaOficinas.itens} totalAtivas={listaOficinas.totalAtivas}
                        oficinasDisponiveis={oficinasDisponiveis}
                        turno={aluno?.turno}
                        idAluno={id}
                        statusAluno={aluno?.status}
                        onSuccess={atualizarDados}
                        permissao={podeEditar}
                    />}
                    <CarregarMais testId="aluno-oficinas-paginacao" listagem={listaOficinas} />
                    </>
                )}
                {abaAtiva === 'atendimentos' && (
                    <>
                    {!listaAtendimentos.carregando && !listaAtendimentos.erro && <Atendimentos atendimentos={listaAtendimentos.itens} total={listaAtendimentos.total} idAluno={id} statusAluno={aluno?.status} onSuccess={atualizarDados} permissao={podeEditar}/>}
                    <CarregarMais testId="aluno-atendimentos-paginacao" listagem={listaAtendimentos} />
                    </>
                )}
                {abaAtiva === 'ocorrencias' && <><Ocorrencias key={id} ocorrencias={listaOcorrencias.itens} idAluno={id} statusAluno={aluno?.status}
                    carregando={listaOcorrencias.carregando} erro={listaOcorrencias.erro}
                    onSuccess={() => setVersaoOcorrencias((versao) => versao + 1)}
                    onTentarNovamente={() => setVersaoOcorrencias((versao) => versao + 1)} />
                    {!listaOcorrencias.carregando && !listaOcorrencias.erro && <CarregarMais testId="aluno-ocorrencias-paginacao" listagem={listaOcorrencias} />}</>}
                {/* {abaAtiva === 'historico' && <AbaHistorico alunoId={id} />} */}
            </div>
            {podeEditar && alunoEdicao && Number(alunoEdicao.id) === Number(id) && <FormularioAluno key={alunoEdicao.id}
                aluno={alunoEdicao} onClose={() => setAlunoEdicao(null)} onSalvo={alunoSalvo} />}
        </div>
    );
}
