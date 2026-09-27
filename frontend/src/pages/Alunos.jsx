import { FiltroEstado } from "../components/FiltroEstado";
import { Pesquisar } from "../components/Pesquisar";
import { Button } from "../components/Button";
import { TabelaAlunos } from "../components/TabelaAlunos";
import { useState, useEffect } from 'react';
import { alunoService } from '../services/alunoService';

export function Alunos() {
    const [alunos, setAlunos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
    }, []);

    if (loading) return <div className="p-4">Carregando alunos...</div>;
    if (error) return <div className="p-4 text-red-600 bg-red-50 rounded">{error}</div>;


    return (
        <div className="flex flex-col gap-lg">
            <div className="flex  w-full  justify-between">
                <FiltroEstado count={4} tipo={"ATIVO"} isSelecionado={false}>
                    Ativos
                </FiltroEstado>
                <FiltroEstado count={2} tipo={"INATIVO"} isSelecionado={false}>
                    Inativos
                </FiltroEstado>
                <FiltroEstado count={1} tipo={"RASCUNHO"} isSelecionado={false}>
                    Rascunhos
                </FiltroEstado>
            </div>
            <div className="flex w-full justify-between">
                <Pesquisar />
                <Button>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M6.99365 2.914V11.0732" stroke="white" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2.91406 6.99361H11.0733" stroke="white" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Novo Aluno
                </Button>
            </div>
            <TabelaAlunos alunos={alunos} />
        </div>
    )
}