import { Spinner } from '../../components/Spinner';
import { ConteudoBotao } from '../../components/ConteudoBotao';
import { useToast } from '../../contexts/ToastContext';
import { Link } from 'react-router-dom';
import { anosLetivosService } from '../../services/anosLetivosService';
import { hojeInstituicao, periodoLetivo } from '../../utils/anoLetivo';
import { useEffect, useRef, useState } from 'react';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Select } from '../../components/Select';
import { SelecaoOpcao } from '../../components/SelecaoOpcao';
import { SelecaoDiasSemana } from '../../components/SelecaoDiasSemana';
import { ambientesService } from '../../services/ambientesService';
import { profissionaisService } from '../../services/profissionaisService';
import { turmasService } from '../../services/turmasService';
import { SeletorProfissional } from './SeletorProfissional';
import { agruparHorarios } from '../../utils/formatters';
import { SaveIcon } from '../../components/icons/SaveIcon';
import { RevisaoAlunosTurma } from './RevisaoAlunosTurma';

const faixasOficina = [
    { value: '08:15', label: 'Manhã: 08:15 – 09:15', turno: 'MANHA', fim: '09:15' },
    { value: '09:45', label: 'Manhã: 09:45 – 11:00', turno: 'MANHA', fim: '11:00' },
    { value: '13:30', label: 'Tarde: 13:30 – 14:45', turno: 'TARDE', fim: '14:45' },
    { value: '15:15', label: 'Tarde: 15:15 – 16:30', turno: 'TARDE', fim: '16:30' },
];
const diasSemana = [1, 2, 3, 4, 5].map((value, indice) => ({ value, label: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'][indice] }));

export function FormularioTurma({ tipoInicial = 'REGULAR', turma, turmaOrigem, onClose, onCriado, onSalvo }) {
    const { notificar } = useToast();
    const editando = Boolean(turma);
    const criandoAPartir = Boolean(turmaOrigem);
    const base = turma ?? turmaOrigem;
    const origemId = turmaOrigem?.id;
    const idTurma = turma?.id;
    const gruposIniciais = agruparHorarios(base?.horarios);
    const diasIniciais = [...new Set(gruposIniciais.flatMap((grupo) => grupo.dias))].sort((a, b) => a - b);
    const profissionaisIniciais = base?.profissionais ?? [];
    const idsIniciais = profissionaisIniciais.map((profissional) => profissional.id).sort((a, b) => a - b);
    const salaInicial = base?.ambiente_id ?? base?.ambiente?.id;
    const envioEmAndamento = useRef(false);
    const [enviando, setEnviando] = useState(false);
    const [formulario, setFormulario] = useState(() => ({
        tipo: base?.tipo ?? tipoInicial, nome: base?.nome ?? '', turno: base?.turno ?? 'MANHA',
        horario: gruposIniciais[0]?.inicio ?? '', dias_semana: diasIniciais, ambiente_id: String(salaInicial ?? ''),
        capacidade_maxima: base?.capacidade_maxima ?? '', descricao: base?.descricao ?? '', profissionais_ids: idsIniciais,
        ano_letivo_id: criandoAPartir ? '' : String(turma?.ano_letivo_id ?? ''),
    }));
    const [erros, setErros] = useState({});
    const [profissionais, setProfissionais] = useState({ status: 'carregando', dados: [] });
    const [calendarios, setCalendarios] = useState({ status: 'carregando', dados: [] });
    const [salas, setSalas] = useState({ status: 'carregando', dados: [] });
    const [tentativa, setTentativa] = useState(0);
    const [infoEdicao, setInfoEdicao] = useState(null);
    const [aba, setAba] = useState('dados');
    const [candidatos, setCandidatos] = useState(null);
    const [origemCarregada, setOrigemCarregada] = useState(null);
    const [selecionados, setSelecionados] = useState([]);
    const [bloqueados, setBloqueados] = useState([]);
    const turnosPreparados = useRef(new Set());
    const origemAplicada = useRef(false);

    useEffect(() => {
        if (!origemId) return;
        const controller = new AbortController();
        const turno = formulario.turno;
        async function carregarAlunos() {
            try {
                const dados = await turmasService.prepararNovaTurma(origemId, turno, controller.signal);
                if (controller.signal.aborted) return;
                if (!origemAplicada.current) {
                    origemAplicada.current = true;
                    setOrigemCarregada(dados.origem);
                    setFormulario((atual) => ({ ...atual, nome: dados.origem.nome, turno: dados.origem.turno,
                        ambiente_id: String(dados.origem.ambiente_id ?? dados.origem.ambiente?.id ?? ''),
                        capacidade_maxima: dados.origem.capacidade_maxima ?? '', descricao: dados.origem.descricao ?? '',
                        profissionais_ids: dados.origem.profissionais.map((profissional) => profissional.id).sort((a, b) => a - b), ano_letivo_id: '' }));
                }
                const ids = new Set(dados.alunos.map((aluno) => aluno.id));
                const anteriores = !turnosPreparados.current.has(turno) ? dados.alunos.filter((aluno) => aluno.ano_anterior).map((aluno) => aluno.id) : [];
                turnosPreparados.current.add(turno);
                setSelecionados((atuais) => [...new Set([...atuais.filter((id) => ids.has(id)), ...anteriores])]);
                setBloqueados((atuais) => atuais.filter((id) => ids.has(id)));
                setCandidatos({ turno, tentativa, status: 'sucesso', dados: dados.alunos });
            } catch (error) {
                if (!controller.signal.aborted) setCandidatos({ turno, tentativa, status: 'erro', dados: [], erro: error.response?.data?.erro || 'Não foi possível carregar os alunos. Tente novamente.' });
            }
        }
        carregarAlunos();
        return () => controller.abort();
    }, [origemId, formulario.turno, tentativa]);

    useEffect(() => {
        if (!idTurma) return;
        const controller = new AbortController();
        async function carregarRestricoes() {
            try {
                const dados = await turmasService.buscarPorId(idTurma, controller.signal);
                if (!controller.signal.aborted) setInfoEdicao({ status: 'sucesso', bloqueada: dados.possui_matriculas });
            } catch {
                if (!controller.signal.aborted) setInfoEdicao({ status: 'erro' });
            }
        }
        carregarRestricoes();
        return () => controller.abort();
    }, [idTurma, tentativa]);

    useEffect(() => {
        const controller = new AbortController();
        async function carregarOpcoes() {
            const resultados = await Promise.allSettled([
                profissionaisService.listarTodos(controller.signal),
                ambientesService.listarTodos(controller.signal),
                anosLetivosService.listarTodos(controller.signal),
            ]);
            if (controller.signal.aborted) return;
            resultados.forEach((resultado, indice) => {
                const definir = [setProfissionais, setSalas, setCalendarios][indice];
                definir(resultado.status === 'fulfilled' ? { status: 'sucesso', dados: resultado.value }
                    : { status: 'erro', dados: [], erro: ['Não foi possível carregar os profissionais.', 'Não foi possível carregar as salas.', 'Não foi possível carregar os calendários.'][indice] });
            });
        }
        carregarOpcoes();
        return () => controller.abort();
    }, [tentativa]);

    const opcoesCalendario = calendarios.dados.filter((c) => c.data_fim.slice(0, 10) >= hojeInstituicao() || (editando && c.id === turma.ano_letivo_id))
        .map((c) => ({ value: c.id, label: `${c.ano} · ${periodoLetivo(c)}` }));
    const calendarioSelecionado = calendarios.dados.find((c) => c.id === Number(formulario.ano_letivo_id));
    const regular = formulario.tipo === 'REGULAR';
    const carregandoAlunos = !candidatos || candidatos.turno !== formulario.turno || candidatos.tentativa !== tentativa;
    const excedeuVagas = formulario.capacidade_maxima !== '' && selecionados.length > Number(formulario.capacidade_maxima);
    const cargosPermitidos = ['professor', 'auxiliar'];
    const compativel = (profissional) => profissional.status_geral === 'ATIVO' && !profissional.excluido
        && cargosPermitidos.includes(profissional.funcao?.trim().toLocaleLowerCase('pt-BR'));
    const opcoesProfissionais = profissionais.dados.map((profissional) => ({ ...profissional, indisponivel: !compativel(profissional) }));
    if (editando || criandoAPartir) {
        for (const profissional of (origemCarregada?.profissionais ?? profissionaisIniciais)) {
            if (!opcoesProfissionais.some((opcao) => opcao.id === profissional.id)) opcoesProfissionais.push({
                id: profissional.id, nome: profissional.pessoa?.nome ?? profissional.nome ?? 'Profissional não informado',
                funcao: profissional.cargo ?? profissional.funcao, indisponivel: true,
            });
        }
    }
    const elegiveis = opcoesProfissionais.filter((profissional) => !profissional.indisponivel || formulario.profissionais_ids.includes(profissional.id));
    const faixa = faixasOficina.find((opcao) => opcao.value === formulario.horario);
    const profissionalValido = formulario.profissionais_ids.length > 0 && formulario.profissionais_ids.every((id) =>
        (editando && idsIniciais.includes(id)) || elegiveis.some((profissional) => profissional.id === id && !profissional.indisponivel));
    const agendaBloqueada = editando && (infoEdicao?.status !== 'sucesso' || infoEdicao.bloqueada);
    const valores = {
        nome: formulario.nome.trim(), ambiente_id: Number(formulario.ambiente_id),
        capacidade_maxima: formulario.capacidade_maxima === '' ? null : Number(formulario.capacidade_maxima),
        descricao: formulario.descricao.trim() || null, profissionais_ids: formulario.profissionais_ids,
        ...(!agendaBloqueada ? (regular ? { turno: formulario.turno, ano_letivo_id: Number(formulario.ano_letivo_id) }
            : { turno: faixa?.turno ?? turma?.turno, hora_inicio: formulario.horario,
                hora_fim: faixa?.fim ?? gruposIniciais[0]?.fim, dias_semana: [...formulario.dias_semana].sort((a, b) => a - b) }) : {}),
    };
    const originais = editando ? { ...turma, ambiente_id: salaInicial, profissionais_ids: idsIniciais,
        hora_inicio: gruposIniciais[0]?.inicio, hora_fim: gruposIniciais[0]?.fim, dias_semana: diasIniciais } : {};
    const alterados = Object.fromEntries(Object.entries(valores).filter(([campo, valor]) => JSON.stringify(valor) !== JSON.stringify(originais[campo])));
    const mudouAgenda = ['turno', 'ano_letivo_id', 'hora_inicio', 'hora_fim', 'dias_semana'].some((campo) => campo in alterados);
    const incompleto = (regular && calendarios.status !== 'sucesso') || !formulario.nome.trim() || !profissionalValido || profissionais.status !== 'sucesso'
        || (criandoAPartir && !origemCarregada)
        || !formulario.ambiente_id || salas.status !== 'sucesso' || (editando && (infoEdicao?.status !== 'sucesso' || !Object.keys(alterados).length))
        || (!editando && (regular ? !formulario.ano_letivo_id : !faixa || formulario.dias_semana.length === 0));
    const opcoesHorario = editando && gruposIniciais.length && !faixasOficina.some((opcao) => opcao.value === gruposIniciais[0].inicio && opcao.fim === gruposIniciais[0].fim)
        ? [...faixasOficina, { value: gruposIniciais[0].inicio, label: `${gruposIniciais[0].inicio} – ${gruposIniciais[0].fim} (atual)` }] : faixasOficina;

    function tentarNovamente() {
        setProfissionais((atual) => ({ ...atual, status: 'carregando' }));
        setSalas((atual) => ({ ...atual, status: 'carregando' }));
        setCalendarios((atual) => ({ ...atual, status: 'carregando' }));
        setInfoEdicao((atual) => atual?.status === 'erro' ? { status: 'carregando', erro: true } : null);
        setTentativa((atual) => atual + 1);
    }

    function fecharModal() {
        if (!envioEmAndamento.current) onClose();
    }

    function atualizarCampo(campo, valor) {
        if (campo === 'tipo' && valor === formulario.tipo) return;
        setFormulario((atual) => ({ ...atual, [campo]: valor }));
        setErros((atuais) => campo === 'tipo' ? {} : { ...atuais, [campo]: undefined });
        if (criandoAPartir && campo === 'turno' && valor !== formulario.turno) {
            setSelecionados([]);
            setBloqueados([]);
        }
    }

    function alternarAluno(id) {
        setSelecionados((atuais) => atuais.includes(id) ? atuais.filter((atual) => atual !== id) : [...atuais, id]);
        setBloqueados((atuais) => atuais.filter((atual) => atual !== id));
    }

    function alternarBloqueio(id) {
        if (!selecionados.includes(id)) return;
        setBloqueados((atuais) => atuais.includes(id) ? atuais.filter((atual) => atual !== id) : [...atuais, id]);
    }

    async function enviar(event) {
        event.preventDefault();
        if (envioEmAndamento.current) return;
        const form = event.currentTarget;
        const novosErros = {};
        if (!formulario.nome.trim()) novosErros.nome = 'Informe o nome da turma ou oficina.';
        if (regular && !agendaBloqueada && !['MANHA', 'TARDE'].includes(formulario.turno)) novosErros.turno = 'Selecione um período.';
        if (regular && !agendaBloqueada && (!formulario.ano_letivo_id || !Number.isInteger(Number(formulario.ano_letivo_id)) || Number(formulario.ano_letivo_id) < 1)) {
            novosErros.ano_letivo_id = 'Selecione um calendário letivo.';
        }

        if (!regular && !agendaBloqueada && (!editando || mudouAgenda) && !faixa) novosErros.horario = 'Selecione um horário para a oficina.';
        if (!regular && !agendaBloqueada && (!editando || mudouAgenda) && (!formulario.dias_semana.length || formulario.dias_semana.some((dia) => ![1, 2, 3, 4, 5].includes(dia)))) {
            novosErros.dias_semana = 'Selecione ao menos um dia de segunda a sexta.';
        }
        if (formulario.capacidade_maxima !== '' && (!Number.isInteger(Number(formulario.capacidade_maxima)) || Number(formulario.capacidade_maxima) < 0)) {
            novosErros.capacidade_maxima = 'Informe um número inteiro de vagas, igual ou maior que zero.';
        }
        if (!formulario.ambiente_id || salas.status !== 'sucesso' || !salas.dados.some((sala) => sala.id === Number(formulario.ambiente_id))) {
            novosErros.ambiente_id = 'Selecione a sala da turma.';
        }
        if (!profissionalValido || profissionais.status !== 'sucesso') novosErros.profissionais_ids = 'Selecione ao menos um professor ou auxiliar disponível.';
        if (editando && infoEdicao?.status !== 'sucesso') {
            notificar('Aguarde a consulta das restrições da turma ou tente novamente.');
            return;
        }
        setErros(novosErros);
        const primeiroErro = Object.keys(novosErros)[0];
        if (primeiroErro) {
            if (criandoAPartir) setAba('dados');
            (form.querySelector(`[name="${primeiroErro}"]`) || form.querySelector('#turma-busca-profissional'))?.focus();
            return;
        }
        if (criandoAPartir && aba === 'dados') { setAba('alunos'); return; }
        if (criandoAPartir && (carregandoAlunos || candidatos.status !== 'sucesso' || excedeuVagas)) return;

        if (editando && !Object.keys(alterados).length) return;
        const dados = editando ? { ...alterados, ambiente_id: Number(formulario.ambiente_id) } : {
            tipo: formulario.tipo, nome: formulario.nome.trim(), turno: regular ? formulario.turno : faixa.turno,
            profissionais_ids: formulario.profissionais_ids, descricao: formulario.descricao.trim() || null,
            ...(formulario.ambiente_id ? { ambiente_id: Number(formulario.ambiente_id) } : {}),
            ...(formulario.capacidade_maxima !== '' ? { capacidade_maxima: Number(formulario.capacidade_maxima) } : {}),
            ...(regular ? { ano_letivo_id: Number(formulario.ano_letivo_id) }
                : { hora_inicio: faixa.value, hora_fim: faixa.fim, dias_semana: [...formulario.dias_semana].sort((a, b) => a - b) }),
        };
        envioEmAndamento.current = true;
        setEnviando(true);
        try {
            if (criandoAPartir) {
                const criada = await turmasService.criarAPartir(origemId, { turma: dados, alunos_ids: selecionados });
                onCriado(criada);
            } else if (editando) {
                const atualizada = await turmasService.editar(turma.id, dados);
                onSalvo(atualizada);
            } else {
                const criada = await turmasService.criar(dados);
                onCriado(criada);
            }
        } catch (error) {
            const errosCampos = {};
            for (const item of error.response?.data?.erros ?? []) {
                const campo = item.path?.[0] === 'turma' ? item.path[1] : item.path?.[0];
                if (campo) errosCampos[['hora_inicio', 'hora_fim'].includes(campo) ? 'horario' : campo] = item.message;
            }
            setErros(errosCampos);
            if (criandoAPartir && Object.keys(errosCampos).some((campo) => campo !== 'alunos_ids')) setAba('dados');
            if (criandoAPartir && error.response?.status === 409) setTentativa((atual) => atual + 1);
            if (!Object.keys(errosCampos).length || errosCampos.alunos_ids) notificar(error.response?.data?.erro || errosCampos.alunos_ids || `Não foi possível ${editando ? 'editar' : 'cadastrar'}. Verifique os dados e tente novamente.`);
        } finally {
            envioEmAndamento.current = false;
            setEnviando(false);
        }
    }

    function acessibilidadeCampo(campo) {
        return { 'aria-invalid': Boolean(erros[campo]), 'aria-describedby': erros[campo] ? `turma-${campo}-erro` : undefined };
    }

    function erroCampo(campo) {
        return erros[campo] && <p id={`turma-${campo}-erro`} className="mb-md text-sm text-red-700">{erros[campo]}</p>;
    }

    return (
        <Modal testId="turma-formulario" isOpen onClose={fecharModal} title={criandoAPartir ? 'Criar turma para novo ano letivo' : editando ? (regular ? 'Editar Turma' : 'Editar Oficina') : 'Nova Turma / Oficina'}
            subtitle={criandoAPartir ? <>Baseada em {(origemCarregada ?? turmaOrigem).nome} · {(origemCarregada ?? turmaOrigem).ano_letivo?.ano}</> : <>Campos marcados com <span className="text-danger">*</span> são obrigatórios</>}
            confirmText={<span className="inline-flex items-center gap-sm">
                <SaveIcon />
                {criandoAPartir ? (aba === 'dados' ? 'Revisar alunos →' : `Criar turma de ${calendarioSelecionado?.ano ?? ''}`) : editando ? 'Salvar alterações' : regular ? 'Salvar Turma' : 'Salvar Oficina'}
            </span>}
            secondaryText="Voltar aos dados" onSecondaryAction={criandoAPartir && aba === 'alunos' ? () => setAba('dados') : undefined}
            confirmFormId="form-cadastro-turma" onConfirm={enviar} isConfirmLoading={enviando}
            isConfirmDisabled={incompleto || (criandoAPartir && aba === 'alunos' && (carregandoAlunos || candidatos.status !== 'sucesso' || excedeuVagas))}>
            {criandoAPartir && <div role="tablist" aria-label="Etapas da nova turma" className="mb-lg grid grid-cols-2 border-b border-slate-200">
                <button data-testid="turma-nova-aba-dados" id="turma-nova-aba-dados" type="button" role="tab" aria-selected={aba === 'dados'} aria-controls="turma-nova-dados" disabled={enviando} onClick={() => setAba('dados')}
                    className={`border-b-2 p-sm text-sm font-semibold ${aba === 'dados' ? 'border-secondary bg-blue-50 text-secondary' : 'border-transparent text-slate-500'}`}>1. Dados da turma</button>
                <button data-testid="turma-nova-aba-alunos" id="turma-nova-aba-alunos" type="button" role="tab" aria-selected={aba === 'alunos'} aria-controls="turma-nova-alunos" disabled={enviando}
                    onClick={() => { if (aba === 'dados') document.getElementById('form-cadastro-turma')?.requestSubmit(); }}
                    className={`border-b-2 p-sm text-sm font-semibold ${aba === 'alunos' ? 'border-secondary bg-blue-50 text-secondary' : 'border-transparent text-slate-500'}`}>2. Revisar alunos</button>
            </div>}
            {criandoAPartir && !origemCarregada && (candidatos?.status === 'erro' ? <div className="mb-md rounded-sm bg-red-50 p-sm text-sm text-red-700">
                <p role="alert">{candidatos.erro}</p><button data-testid="turma-nova-origem-tentar-novamente" type="button" onClick={() => setTentativa((atual) => atual + 1)} disabled={carregandoAlunos} className="mt-sm underline"><ConteudoBotao carregando={carregandoAlunos}>Tentar novamente</ConteudoBotao></button>
            </div> : <div className="mb-md text-sm text-text-muted flex items-center gap-sm"><Spinner label="Carregando dados da turma anterior..." /><span>Carregando dados da turma anterior...</span></div>)}
            <form id="form-cadastro-turma" onSubmit={enviar} noValidate>
                <fieldset disabled={enviando || (criandoAPartir && !origemCarregada)} className="min-w-0">
                    <div id="turma-nova-dados" data-testid={criandoAPartir ? 'turma-nova-dados' : undefined} role={criandoAPartir ? 'tabpanel' : undefined} aria-labelledby={criandoAPartir ? 'turma-nova-aba-dados' : undefined} hidden={criandoAPartir && aba !== 'dados'}>
                    {criandoAPartir && <p className="mb-md rounded-sm border border-amber-200 bg-amber-50 p-sm text-sm text-amber-800">Os dados da turma anterior foram copiados. Revise as informações e os alunos antes de criar a nova turma.</p>}
                    {!criandoAPartir && <SelecaoOpcao testId="turma-formulario-tipo" label="Tipo de turma" labelClassName="font-mono" name="tipo" required value={formulario.tipo} disabled={editando}
                        className="[&>div]:flex-col sm:[&>div]:flex-row" optionClassName="min-w-0"
                        onChange={(valor) => atualizarCampo('tipo', valor)} options={[
                            { value: 'REGULAR', title: 'Turma Regular', subtitle: 'Aulas diárias com cronograma fixo' },
                            { value: 'OFICINA', title: 'Oficina', subtitle: 'Aulas semanais' },
                        ]} />}
                    {editando && !infoEdicao && <div className="mb-md text-sm text-slate-500 flex items-center gap-sm"><Spinner label="Consultando matrículas e histórico..." /><span>Consultando matrículas e histórico...</span></div>}
                    {editando && (infoEdicao?.status === 'erro' || infoEdicao?.erro) && <div className="mb-md text-sm text-red-700"><p role="alert">Não foi possível consultar as restrições da turma.</p><button data-testid="turma-formulario-restricoes-tentar-novamente" type="button" className="underline" onClick={tentarNovamente} disabled={infoEdicao?.status === 'carregando'}><ConteudoBotao carregando={infoEdicao?.status === 'carregando'}>Tentar novamente</ConteudoBotao></button></div>}
                    {infoEdicao?.bloqueada && <p className="mb-md rounded-sm bg-tertiary/20 p-sm text-sm text-amber-800 border border-amber-800">Esta turma possui matrículas ativas ou histórico de matrículas. Alguns dados não podem ser alterados.</p>}
                    <Input data-testid="turma-formulario-nome" id="turma-nome" label="Nome" labelClassName="font-mono" name="nome" required
                        value={formulario.nome} onChange={(event) => atualizarCampo('nome', event.target.value)}
                        placeholder={regular ? 'Ex: Turma Girassol' : 'Ex: Oficina de Artes'} {...acessibilidadeCampo('nome')} />
                    {erroCampo('nome')}
                    {regular ? <>
                        <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
                            <div className="sm:col-span-2">
                                <SelecaoOpcao testId="turma-formulario-turno" label="Período" labelClassName="font-mono" name="turno" required value={formulario.turno} disabled={agendaBloqueada}
                                    onChange={(valor) => atualizarCampo('turno', valor)} options={[{ value: 'MANHA', title: 'Manhã' }, { value: 'TARDE', title: 'Tarde' }]} />
                                {erroCampo('turno')}
                            </div>
                            <div>
                                <Select data-testid="turma-formulario-ano-letivo" id="turma-ano" label="Ano letivo" labelClassName="font-mono" name="ano_letivo_id" required disabled={agendaBloqueada || calendarios.status !== 'sucesso'}
                                    options={opcoesCalendario} loading={calendarios.status === 'carregando'} loadingLabel="Carregando calendários..." value={formulario.ano_letivo_id} onChange={(event) => atualizarCampo('ano_letivo_id', event.target.value)} {...acessibilidadeCampo('ano_letivo_id')} />
                                {calendarios.erro && <p role="alert" className="text-sm text-danger">Não foi possível carregar os calendários. <button data-testid="turma-calendarios-tentar" type="button" onClick={tentarNovamente} className="underline" disabled={calendarios.status === 'carregando'}><ConteudoBotao carregando={calendarios.status === 'carregando'}>Tentar novamente</ConteudoBotao></button></p>}
                                {calendarios.status === 'sucesso' && !opcoesCalendario.length && <p className="text-sm text-text-muted">Cadastre um calendário em <Link to="/configuracoes" className="text-tertiary underline">Configurações</Link>.</p>}
                                {erroCampo('ano_letivo_id')}
                            </div>
                        </div>
                        <div className="mb-lg rounded-sm border border-blue-100 bg-blue-50 p-md">
                            <h3 className="mb-sm font-mono text-xs font-semibold uppercase tracking-wider text-blue-600">Cronograma fixo (gerado automaticamente)</h3>
                            {editando && agendaBloqueada && gruposIniciais.length ? <dl className="space-y-xs text-sm">{gruposIniciais.map((grupo) => <div key={`${grupo.inicio}-${grupo.fim}`} className="flex justify-between gap-sm"><dt>{grupo.dias.map((dia) => diasSemana.find((opcao) => opcao.value === dia)?.label ?? dia).join(', ')}</dt><dd className="font-mono text-blue-600">{grupo.inicio} – {grupo.fim}</dd></div>)}</dl> : formulario.turno === 'MANHA' ? <dl className="grid grid-cols-[1fr_auto] gap-x-sm gap-y-xs text-sm">
                                <dt>Seg, Ter, Qui, Sex</dt><dd className="font-mono text-blue-600">07:30 – 11:30</dd>
                                <dt>Quarta</dt><dd className="font-mono text-blue-600">12:30 – 16:30</dd>
                            </dl> : <dl className="grid grid-cols-[1fr_auto] gap-sm text-sm"><dt>Segunda a sexta</dt><dd className="font-mono text-blue-600">12:30 – 16:30</dd></dl>}
                        </div>
                    </> : <>
                        <Select data-testid="turma-formulario-horario" id="turma-horario" label="Horário" labelClassName="font-mono" name="horario" required placeholder="Selecione um horário" disabled={agendaBloqueada}
                            options={opcoesHorario} value={formulario.horario} onChange={(event) => atualizarCampo('horario', event.target.value)} error={erros.horario} />
                        <SelecaoDiasSemana testId="turma-formulario-dias-semana" label="Dia(s) da semana" labelClassName="font-mono" name="dias_semana" required
                            value={formulario.dias_semana} options={diasSemana} allowSelectAll={false} containerClassName="grid! grid-cols-5 gap-xs!" disabled={agendaBloqueada}
                            onChange={(valor) => atualizarCampo('dias_semana', valor)} />
                        {erroCampo('dias_semana')}
                    </>}
                    <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
                        <div>
                            <Select data-testid="turma-formulario-sala" id="turma-sala" label="Sala / ambiente" labelClassName="font-mono" name="ambiente_id" placeholder="Selecione uma sala" required
                                value={formulario.ambiente_id} onChange={(event) => atualizarCampo('ambiente_id', event.target.value)}
                                disabled={salas.status !== 'sucesso'} loading={salas.status === 'carregando'} loadingLabel="Carregando salas..." options={salas.dados.map((sala) => ({ value: sala.id, label: sala.nome }))} error={erros.ambiente_id} />
                            {salas.erro && <div className="mb-md text-sm text-red-700"><p role="alert">{salas.erro}</p>
                                <button data-testid="turma-formulario-salas-tentar-novamente" type="button" onClick={tentarNovamente} className="mt-xs underline" disabled={salas.status === 'carregando'}><ConteudoBotao carregando={salas.status === 'carregando'}>Tentar novamente</ConteudoBotao></button></div>}
                        </div>
                        <div>
                            <Input data-testid="turma-formulario-vagas" id="turma-vagas" label="Vagas" labelClassName="font-mono" name="capacidade_maxima" type="number" min="0" step="1" placeholder="Ex: 12"
                                value={formulario.capacidade_maxima} onChange={(event) => atualizarCampo('capacidade_maxima', event.target.value)} {...acessibilidadeCampo('capacidade_maxima')} />
                            {erroCampo('capacidade_maxima')}
                        </div>
                    </div>
                    <div className="mb-lg">
                        <label htmlFor="turma-descricao" className="mb-sm block font-mono text-xs font-semibold uppercase tracking-wider text-slate-600">Descrição</label>
                        <textarea data-testid="turma-formulario-descricao" id="turma-descricao" name="descricao" rows={3} placeholder="Breve descrição da turma ou oficina..."
                            className="w-full resize-y rounded-sm border border-slate-200 bg-bg-surface px-md py-sm text-sm text-text-main placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-secondary"
                            value={formulario.descricao} onChange={(event) => atualizarCampo('descricao', event.target.value)} {...acessibilidadeCampo('descricao')} />
                        {erroCampo('descricao')}
                    </div>
                    <SeletorProfissional key={formulario.tipo} profissionais={elegiveis} value={formulario.profissionais_ids}
                        onChange={(valor) => atualizarCampo('profissionais_ids', valor)} carregando={profissionais.status === 'carregando'}
                        erroCarga={profissionais.erro} onTentarNovamente={tentarNovamente} error={erros.profissionais_ids} />
                    {criandoAPartir && profissionais.status === 'sucesso' && !profissionalValido && <p role="alert" className="mb-md text-sm text-amber-800">Revise a equipe da turma anterior: selecione apenas professores ou auxiliares ativos e disponíveis.</p>}
                    </div>
                    {criandoAPartir && <div id="turma-nova-alunos" data-testid="turma-nova-alunos" role="tabpanel" aria-labelledby="turma-nova-aba-alunos" hidden={aba !== 'alunos'}>
                        <RevisaoAlunosTurma alunos={carregandoAlunos ? [] : candidatos.dados} selecionados={selecionados} bloqueados={bloqueados} capacidade={formulario.capacidade_maxima}
                            onSelecionar={alternarAluno} onBloquear={alternarBloqueio} onSortear={(ids) => { setSelecionados(ids); }} disabled={enviando}
                            carregando={carregandoAlunos} erro={candidatos?.turno === formulario.turno ? candidatos?.erro : undefined} onTentarNovamente={() => setTentativa((atual) => atual + 1)} />
                    </div>}
                </fieldset>
            </form>
        </Modal>
    );
}
