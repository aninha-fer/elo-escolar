import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuth } from '../../contexts/AuthContext';
import { AlternadorTipoTurma } from './AlternadorTipoTurma';
import { turmasService } from '../../services/turmasService';
import { TurmaItem } from './TurmaItem';
import { normalizarProfissionais } from '../../utils/formatters';
import { FormularioTurma } from './FormularioTurma';

function normalizarTexto(valor = '') {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function Turmas() {
    const navigate = useNavigate();
    const [tipoTurma, setTipoTurma] = useState('REGULAR');
    const [resultado, setResultado] = useState({ tipo: 'REGULAR', tentativa: 0, status: 'carregando', turmas: [] });
    const [tentativa, setTentativa] = useState(0);
    const [termoBusca, setTermoBusca] = useState('');
    const [aviso, setAviso] = useState('');
    const { usuario } = useAuth();
    const podeEditar = usuario?.role === 'admin';
    const [modalAberto, setModalAberto] = useState(false);


    useEffect(() => {
        const controller = new AbortController();
        async function carregarTurmas() {
            try {
                const dados = tipoTurma === 'REGULAR'
                    ? await turmasService.listarRegularesDisponiveis(controller.signal)
                    : await turmasService.listarOficinasDisponiveis(controller.signal);
                if (!controller.signal.aborted) {
                    setResultado({ tipo: tipoTurma, tentativa, status: 'sucesso', turmas: dados.map((turma) => ({ ...turma, profissionais: normalizarProfissionais(turma) })) });
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    setResultado({ tipo: tipoTurma, tentativa, status: 'erro', turmas: [], erro: error.response?.data?.erro || 'Não foi possível carregar as turmas. Tente novamente.' });
                }
            }
        }
        carregarTurmas();
        return () => controller.abort();
    }, [tipoTurma, tentativa]);

    const carregando = resultado.tipo !== tipoTurma || resultado.tentativa !== tentativa || resultado.status === 'carregando';
    const erro = !carregando && resultado.status === 'erro' ? resultado.erro : '';
    const busca = normalizarTexto(termoBusca);
    const filtrados = resultado.turmas.filter((turma) => normalizarTexto(turma.nome).includes(busca));

    function trocarTipo(tipo) {
        setTipoTurma(tipo);
        setAviso('');
    }

    function tentarNovamente() {
        setTentativa((atual) => atual + 1);
    }

    function turmaCriada(turma) {
        setTipoTurma(turma.tipo);
        setTentativa((atual) => atual + 1);
        setTermoBusca('');
        setModalAberto(false);
        setAviso(turma.tipo === 'REGULAR' ? 'Turma cadastrada com sucesso.' : 'Oficina cadastrada com sucesso.');
    }

    return (
        <section className="flex min-w-0 flex-col gap-lg" aria-labelledby="turmas-titulo">
            <h1 id="turmas-titulo" className="text-xl font-bold text-text-main">Turmas</h1>
            <div>
                <div className="flex w-full flex-col gap-sm sm:flex-row sm:items-stretch">
                    <Input placeholder="Pesquisar por nome..." aria-label="Pesquisar por nome"
                        value={termoBusca} onChange={(event) => setTermoBusca(event.target.value)}
                        icon={
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M6.23896 10.9637C8.74484 10.9637 10.7763 8.93233 10.7763 6.42645C10.7763 3.92056 8.74484 1.88914 6.23896 1.88914C3.73308 1.88914 1.70166 3.92056 1.70166 6.42645C1.70166 8.93233 3.73308 10.9637 6.23896 10.9637Z" stroke="currentColor" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M11.9105 12.0981L9.44336 9.63091" stroke="currentColor" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        } />
                    {podeEditar && <Button type="button"
                        onClick={() => { setAviso(''); setModalAberto(true); }}>
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M6.99365 2.914V11.0732M2.91406 6.99361H11.0733" stroke="currentColor" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {tipoTurma === 'REGULAR' ? 'Nova Turma' : 'Nova Oficina'}
                    </Button>}
                </div>
                <AlternadorTipoTurma value={tipoTurma} onChange={trocarTipo} />
            </div>
            {aviso && <p role="status" className="rounded-sm bg-emerald-50 p-md text-sm text-emerald-700">{aviso}</p>}
            {carregando ? <p role="status">Carregando {tipoTurma === 'REGULAR' ? 'turmas regulares' : 'oficinas'}...</p> : erro ? (
                <div className="rounded-sm bg-red-50 p-md text-sm text-red-700">
                    <p role="alert">{erro}</p>
                    <button type="button" onClick={tentarNovamente} className="mt-sm rounded-sm border border-danger px-sm py-xs font-semibold">Tentar novamente</button>
                </div>
            ) : filtrados.length === 0 ? (
                <p role="status" className="rounded-md border border-slate-200 bg-bg-surface px-lg py-10 text-center text-sm text-slate-500">
                    {tipoTurma === 'REGULAR' ? 'Nenhuma turma regular encontrada.' : 'Nenhuma oficina encontrada.'}
                </p>
            ) : (
                <ul aria-label={tipoTurma === 'REGULAR' ? 'Turmas regulares' : 'Oficinas'} className="flex min-w-0 flex-col gap-sm">
                    {filtrados.map((turma) => <TurmaItem key={turma.id} turma={turma} profissionais={turma.profissionais} podeEditar={podeEditar}
                        onSelecionar={(selecionada) => navigate(`/turmas/${selecionada.id}`)} />)}
                </ul>
            )}
            {modalAberto && podeEditar && <FormularioTurma tipoInicial={tipoTurma} onClose={() => setModalAberto(false)} onCriado={turmaCriada} />}
        </section>
    );
}
