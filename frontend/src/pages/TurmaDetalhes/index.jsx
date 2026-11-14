import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { DivInformacoes } from '../../components/DivInformacoes';
import { turmasService } from '../../services/turmasService';
import { agruparHorarios, formatarFrequencia, formatarTurno } from '../../utils/formatters';
import { AlunosVinculados } from './components/AlunosVinculados';
import { VincularAlunoModal } from './components/VincularAlunoModal';
import { CampoInformacao } from '../../components/CampoInformacao';
import { BotaoVoltar } from '../../components/BotaoVoltar';

const estilosStatus = { ATIVO: 'bg-emerald-50 text-emerald-600', INATIVO: 'bg-slate-100 text-slate-500', PROVISORIO: 'bg-amber-50 text-amber-700' };
const rotulosStatus = { ATIVO: 'Ativa', INATIVO: 'Inativa', PROVISORIO: 'Provisória' };

export function TurmaDetalhes() {
    const { id } = useParams();
    const { usuario } = useAuth();
    const [resultado, setResultado] = useState(null);
    const [tentativa, setTentativa] = useState(0);
    const [modalAberto, setModalAberto] = useState(false);
    const [aviso, setAviso] = useState('');
    const idValido = /^\d+$/.test(id) && Number(id) > 0 && Number(id) <= 2147483647;

    useEffect(() => {
        if (!idValido) return;
        const controller = new AbortController();
        async function carregarTurma() {
            try {
                const dados = await turmasService.buscarPorId(id, controller.signal);
                if (!controller.signal.aborted) setResultado({ id, tentativa, dados, status: 'sucesso' });
            } catch (error) {
                if (!controller.signal.aborted) setResultado({
                    id, tentativa, status: 'erro', codigo: error.response?.status,
                    erro: error.response?.data?.erro || 'Não foi possível carregar os dados da turma.'
                });
            }
        }
        carregarTurma();
        return () => controller.abort();
    }, [id, tentativa, idValido]);

    if (!idValido) return (
        <div className="space-y-md">
            <BotaoVoltar to='/turmas' />
            <p role="alert" className="text-red-700">Identificador de turma inválido.</p>
        </div>
    );
    if (!resultado || resultado.id !== id || resultado.tentativa !== tentativa) return <div className="space-y-md"><BotaoVoltar to='/turmas' /><p role="status">Carregando dados da turma...</p></div>;
    if (resultado.status === 'erro') return <div className="space-y-md"><BotaoVoltar to='/turmas' />
        <div className="rounded-sm bg-red-50 p-md text-sm text-red-700"><p role="alert">{resultado.codigo === 404 ? 'Turma não encontrada.' : resultado.erro}</p>
            {resultado.codigo !== 404 && <button type="button" onClick={() => setTentativa((atual) => atual + 1)} className="mt-sm underline">Tentar novamente</button>}
        </div></div>;

    const turma = resultado.dados;
    const regular = turma.tipo === 'REGULAR';
    const tipo = regular ? 'Turma Regular' : 'Oficina';
    const grupos = agruparHorarios(turma.horarios);
    const dias = [...new Set(grupos.flatMap((grupo) => grupo.dias))].sort((a, b) => a - b);
    const nomeProfissional = turma.profissional?.pessoa?.nome;
    const podeVincular = usuario?.role === 'admin' && regular && turma.status === 'ATIVO';
    const campos = [
        ['Período', formatarTurno(turma.turno)],
        ['Dias da semana', dias.length ? formatarFrequencia(dias) : 'Não informados'],
        ...(!regular ? [['Horário', grupos.length ? grupos.map((grupo) => `${grupo.inicio}–${grupo.fim}`).join(' · ') : 'Não informado']] : []),
        ...(regular ? [['Ano letivo', turma.ano_letivo ?? 'Não informado']] : []),
        ['Vagas', turma.capacidade_maxima ?? 'Sem limite de vagas'],
    ];

    function alunoVinculado(matricula) {
        setModalAberto(false);
        setAviso(matricula.status === 'PROVISORIO'
            ? 'Vínculo provisório criado no planejamento do aluno em rascunho. Ele não ocupa vaga nem aparece na lista de matrículas ativas até a ativação.'
            : 'Aluno vinculado à turma com sucesso.');
        setTentativa((atual) => atual + 1);
    }

    return (
        <section className="min-w-0 space-y-lg" aria-labelledby="turma-detalhes-titulo">
            <header className="flex flex-wrap items-center gap-md">
                <BotaoVoltar to='/turmas' />
                <div className="min-w-0 flex-1"><h1 id="turma-detalhes-titulo" className="break-words text-xl font-bold text-text-main">{turma.nome}</h1><p className="mt-xs text-sm text-slate-500">{tipo}</p></div>
                <span className={`rounded-full px-md py-sm text-sm font-semibold ${estilosStatus[turma.status] ?? 'bg-slate-100 text-slate-500'}`}>{rotulosStatus[turma.status] ?? 'Não definido'}</span>
            </header>
            {aviso && <p role="status" className="rounded-sm bg-emerald-50 p-md text-sm text-emerald-700">{aviso}</p>}
            <div className="grid min-w-0 grid-cols-1 gap-lg xl:grid-cols-[minmax(0,1fr)_minmax(0,1.75fr)]">
                <DivInformacoes>
                    <dl>
                        {campos.map(([titulo, valor]) => <CampoInformacao key={titulo} titulo={titulo} valor={valor} />)}
                    </dl>
                    {turma.descricao && (
                        <dl className="mt-md border-t border-gray-200 pt-sm">
                            <CampoInformacao titulo="Descrição" valor={turma.descricao} />
                        </dl>
                    )}
                    <div className="mt-sm border-t border-gray-200 pt-md">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Profissional responsável</h4>
                        {nomeProfissional ? <div className="break-words text-sm text-text-main">
                            <p>{nomeProfissional}</p>
                            <p className="mt-xs text-xs text-text-muted">{turma.profissional.cargo || 'Função não informada'}</p>
                        </div> : <p className="text-sm text-slate-500">Não informado</p>}
                    </div>
                </DivInformacoes>
                <AlunosVinculados alunos={turma.alunos} capacidade={turma.capacidade_maxima} podeVincular={podeVincular} onVincular={() => { setAviso(''); setModalAberto(true); }} />
            </div>
            {/* {modalAberto && podeVincular && <VincularAlunoModal key={id} turma={turma} onClose={() => setModalAberto(false)} onVinculado={alunoVinculado} />} */}
        </section>
    );
}
