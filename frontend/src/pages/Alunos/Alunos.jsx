import { useState, useEffect } from 'react';
import { FiltroEstado } from "../../components/FiltroEstado";
import { Button } from "../../components/Button";
import { TabelaAlunos } from "./TabelaAlunos";
import { alunoService } from '../../services/alunoService';
import { Input } from "../../components/Input";
import { FormularioAluno } from './FormularioAluno';
import { useAuth } from '../../contexts/AuthContext';

function normalizarTexto(valor = '') {
    return String(valor)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR')
        .trim();
}


export function Alunos() {
    const [alunos, setAlunos] = useState([]);
    const [alunoEdicao, setAlunoEdicao] = useState(null);
    const [erroEdicao, setErroEdicao] = useState('');
    const [carregandoEdicao, setCarregandoEdicao] = useState(false);
    const [tentativa, setTentativa] = useState(0);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);


    const [statusSelecionado, setStatusSelecionado] = useState('TODOS');
    const [termoBusca, setTermoBusca] = useState('');


    const { usuario } = useAuth();
    const podeEditar = usuario?.role === 'admin';

    useEffect(() => {
        const controller = new AbortController();

        async function carregarAlunos() {
            try {
                setLoading(true);
                setError(null);

                const dados = await alunoService.listarTodos({}, controller.signal);
                setAlunos(dados);
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;

                const mensagemErro = err.response?.data?.erro || 'Não foi possível carregar a lista de alunos.';
                setError(mensagemErro);
            } finally {
                setLoading(false);
            }
        }

        carregarAlunos();

        return () => controller.abort();
    }, [tentativa]);

    const contagemStatus = alunos.reduce((contagem, aluno) => {
        const status = aluno.status ?? 'RASCUNHO';
        contagem.TODOS += 1;

        if (Object.hasOwn(contagem, status)) {
            contagem[status] += 1;
        }

        return contagem;
    }, { TODOS: 0, ATIVO: 0, INATIVO: 0, RASCUNHO: 0 });

    const termoNormalizado = normalizarTexto(termoBusca);
    const alunosFiltrados = alunos.filter((aluno) => {
        const statusCorresponde = statusSelecionado === 'TODOS'
            || (aluno.status ?? 'RASCUNHO') === statusSelecionado;
        const nomeCorresponde = !termoNormalizado
            || normalizarTexto(aluno.nome).includes(termoNormalizado)
            || (aluno.responsaveis ?? []).some((responsavel) => normalizarTexto(responsavel.nome).includes(termoNormalizado));

        return statusCorresponde && nomeCorresponde;
    });

    if (loading) return <div className="p-4">Carregando alunos...</div>;
    if (error) return <div className="p-4 text-red-600 bg-red-50 rounded">{error}</div>;

    async function abrirEdicao(aluno) {
        try {
            setErroEdicao('');
            setCarregandoEdicao(true);
            const dados = await alunoService.buscarPorId(aluno.id);
            setAlunoEdicao(dados);
            setIsModalOpen(true);
        } catch { setErroEdicao('Não foi possível carregar o aluno para edição.'); }
        finally { setCarregandoEdicao(false); }
    }
    function abrirModal() { setAlunoEdicao(null); setIsModalOpen(true); }
    function fecharModal() { setIsModalOpen(false); setAlunoEdicao(null); }
    function alunoSalvo() { fecharModal(); setTentativa((v) => v + 1); }

    return (
        <div className="flex flex-col gap-lg">
            <div className="flex w-full flex-col gap-sm sm:flex-row sm:items-stretch">
                <FiltroEstado
                    count={contagemStatus.TODOS}
                    tipo="TODOS"
                    isSelecionado={statusSelecionado === 'TODOS'}
                    aria-pressed={statusSelecionado === 'TODOS'}
                    onClick={() => setStatusSelecionado('TODOS')}
                >
                    Todos
                </FiltroEstado>
                <FiltroEstado
                    count={contagemStatus.ATIVO}
                    tipo="ATIVO"
                    isSelecionado={statusSelecionado === 'ATIVO'}
                    aria-pressed={statusSelecionado === 'ATIVO'}
                    onClick={() => setStatusSelecionado('ATIVO')}
                >
                    Ativos
                </FiltroEstado>
                <FiltroEstado
                    count={contagemStatus.INATIVO}
                    tipo="INATIVO"
                    isSelecionado={statusSelecionado === 'INATIVO'}
                    aria-pressed={statusSelecionado === 'INATIVO'}
                    onClick={() => setStatusSelecionado('INATIVO')}
                >
                    Inativos
                </FiltroEstado>
                <FiltroEstado
                    count={contagemStatus.RASCUNHO}
                    tipo="RASCUNHO"
                    isSelecionado={statusSelecionado === 'RASCUNHO'}
                    aria-pressed={statusSelecionado === 'RASCUNHO'}
                    onClick={() => setStatusSelecionado('RASCUNHO')}
                >
                    Rascunhos
                </FiltroEstado>
            </div>
            <div className="flex w-full flex-col gap-sm sm:flex-row sm:items-stretch">
                <Input
                    placeholder="Pesquisar por nome do aluno ou responsável..."
                    aria-label="Pesquisar por nome do aluno ou responsável"
                    value={termoBusca}
                    onChange={(event) => setTermoBusca(event.target.value)}
                    icon={
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2">
                            <path d="M6.23896 10.9637C8.74484 10.9637 10.7763 8.93233 10.7763 6.42645C10.7763 3.92056 8.74484 1.88914 6.23896 1.88914C3.73308 1.88914 1.70166 3.92056 1.70166 6.42645C1.70166 8.93233 3.73308 10.9637 6.23896 10.9637Z" stroke="#1A202C" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M11.9105 12.0981L9.44336 9.63091" stroke="#1A202C" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    }
                />
                {podeEditar && <Button className="shrink-0" onClick={abrirModal}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M6.99365 2.914V11.0732" stroke="white" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2.91406 6.99361H11.0733" stroke="white" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Novo Aluno
                </Button>}
                {isModalOpen && podeEditar && <FormularioAluno aluno={alunoEdicao} onClose={fecharModal} onSalvo={alunoSalvo} />}
            </div>
            {carregandoEdicao && <p role="status">Carregando dados para edição...</p>}
            {erroEdicao && <p role="alert" className="text-sm text-red-700">{erroEdicao}</p>}
            <TabelaAlunos alunos={alunosFiltrados} onAcao={podeEditar && !carregandoEdicao ? abrirEdicao : undefined} />
        </div>
    )
}
