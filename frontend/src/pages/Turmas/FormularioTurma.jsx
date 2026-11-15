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

const faixasOficina = [
    { value: '08:15', label: 'Manhã: 08:15 – 09:15', turno: 'MANHA', fim: '09:15' },
    { value: '09:45', label: 'Manhã: 09:45 – 11:00', turno: 'MANHA', fim: '11:00' },
    { value: '13:30', label: 'Tarde: 13:30 – 14:45', turno: 'TARDE', fim: '14:45' },
    { value: '15:15', label: 'Tarde: 15:15 – 16:30', turno: 'TARDE', fim: '16:30' },
];
const diasSemana = [1, 2, 3, 4, 5].map((value, indice) => ({ value, label: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'][indice] }));

export function FormularioTurma({ tipoInicial = 'REGULAR', turma, onClose, onCriado, onSalvo }) {
    const editando = Boolean(turma);
    const idTurma = turma?.id;
    const gruposIniciais = agruparHorarios(turma?.horarios);
    const diasIniciais = [...new Set(gruposIniciais.flatMap((grupo) => grupo.dias))].sort((a, b) => a - b);
    const profissionalInicial = turma?.profissional_id ?? turma?.profissional?.id;
    const salaInicial = turma?.ambiente_id ?? turma?.ambiente?.id;
    const envioEmAndamento = useRef(false);
    const [enviando, setEnviando] = useState(false);
    const [formulario, setFormulario] = useState(() => ({
        tipo: turma?.tipo ?? tipoInicial, nome: turma?.nome ?? '', turno: turma?.turno ?? 'MANHA',
        horario: gruposIniciais[0]?.inicio ?? '', dias_semana: diasIniciais, ambiente_id: String(salaInicial ?? ''),
        capacidade_maxima: turma?.capacidade_maxima ?? '', descricao: turma?.descricao ?? '', profissional_id: String(profissionalInicial ?? ''),
        ano_letivo: turma?.ano_letivo ?? (editando ? '' : new Intl.DateTimeFormat('pt-BR', { year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date())),
    }));
    const [erros, setErros] = useState({});
    const [erroEnvio, setErroEnvio] = useState('');
    const [profissionais, setProfissionais] = useState({ status: 'carregando', dados: [] });
    const [salas, setSalas] = useState({ status: 'carregando', dados: [] });
    const [tentativa, setTentativa] = useState(0);
    const [infoEdicao, setInfoEdicao] = useState(null);

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
            ]);
            if (controller.signal.aborted) return;
            resultados.forEach((resultado, indice) => {
                const definir = indice === 0 ? setProfissionais : setSalas;
                definir(resultado.status === 'fulfilled' ? { status: 'sucesso', dados: resultado.value }
                    : { status: 'erro', dados: [], erro: indice === 0 ? 'Não foi possível carregar os profissionais.' : 'Não foi possível carregar as salas.' });
            });
        }
        carregarOpcoes();
        return () => controller.abort();
    }, [tentativa]);

    const regular = formulario.tipo === 'REGULAR';
    const cargosPermitidos = regular ? ['professor', 'auxiliar'] : ['professor', 'oficineiro'];
    const elegiveis = profissionais.dados.filter((profissional) => (editando && profissional.id === profissionalInicial)
        || (profissional.status_geral === 'ATIVO' && cargosPermitidos.includes(profissional.funcao?.trim().toLocaleLowerCase('pt-BR'))));
    const faixa = faixasOficina.find((opcao) => opcao.value === formulario.horario);
    const profissionalValido = (editando && Number(formulario.profissional_id) === profissionalInicial)
        || elegiveis.some((profissional) => profissional.id === Number(formulario.profissional_id));
    const agendaBloqueada = editando && (infoEdicao?.status !== 'sucesso' || infoEdicao.bloqueada);
    const valores = {
        nome: formulario.nome.trim(), ambiente_id: Number(formulario.ambiente_id),
        capacidade_maxima: formulario.capacidade_maxima === '' ? null : Number(formulario.capacidade_maxima),
        descricao: formulario.descricao.trim() || null, profissional_id: Number(formulario.profissional_id),
        ...(!agendaBloqueada ? (regular ? { turno: formulario.turno, ano_letivo: Number(formulario.ano_letivo) }
            : { turno: faixa?.turno ?? turma?.turno, hora_inicio: formulario.horario,
                hora_fim: faixa?.fim ?? gruposIniciais[0]?.fim, dias_semana: [...formulario.dias_semana].sort((a, b) => a - b) }) : {}),
    };
    const originais = editando ? { ...turma, ambiente_id: salaInicial, profissional_id: profissionalInicial,
        hora_inicio: gruposIniciais[0]?.inicio, hora_fim: gruposIniciais[0]?.fim, dias_semana: diasIniciais } : {};
    const alterados = Object.fromEntries(Object.entries(valores).filter(([campo, valor]) => JSON.stringify(valor) !== JSON.stringify(originais[campo])));
    const mudouAgenda = ['turno', 'ano_letivo', 'hora_inicio', 'hora_fim', 'dias_semana'].some((campo) => campo in alterados);
    const incompleto = !formulario.nome.trim() || !profissionalValido || profissionais.status !== 'sucesso'
        || !formulario.ambiente_id || salas.status !== 'sucesso' || (editando && (infoEdicao?.status !== 'sucesso' || !Object.keys(alterados).length))
        || (!editando && (regular ? !formulario.ano_letivo : !faixa || formulario.dias_semana.length === 0));
    const opcoesHorario = editando && gruposIniciais.length && !faixasOficina.some((opcao) => opcao.value === gruposIniciais[0].inicio && opcao.fim === gruposIniciais[0].fim)
        ? [...faixasOficina, { value: gruposIniciais[0].inicio, label: `${gruposIniciais[0].inicio} – ${gruposIniciais[0].fim} (atual)` }] : faixasOficina;

    function tentarNovamente() {
        setProfissionais({ status: 'carregando', dados: [] });
        setSalas({ status: 'carregando', dados: [] });
        setInfoEdicao(null);
        setTentativa((atual) => atual + 1);
    }

    function fecharModal() {
        if (!envioEmAndamento.current) onClose();
    }

    function atualizarCampo(campo, valor) {
        if (campo === 'tipo' && valor === formulario.tipo) return;
        setFormulario((atual) => ({ ...atual, [campo]: valor, ...(campo === 'tipo' ? { profissional_id: '' } : {}) }));
        setErros((atuais) => campo === 'tipo' ? {} : { ...atuais, [campo]: undefined });
        setErroEnvio('');
    }

    async function enviar(event) {
        event.preventDefault();
        if (envioEmAndamento.current) return;
        const form = event.currentTarget;
        const novosErros = {};
        if (!formulario.nome.trim()) novosErros.nome = 'Informe o nome da turma ou oficina.';
        if (regular && !agendaBloqueada && !['MANHA', 'TARDE'].includes(formulario.turno)) novosErros.turno = 'Selecione um período.';
        if (regular && !agendaBloqueada && (!formulario.ano_letivo || !Number.isInteger(Number(formulario.ano_letivo)) || Number(formulario.ano_letivo) < 1)) {
            novosErros.ano_letivo = 'Informe um ano letivo inteiro e positivo.';
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
        if (!profissionalValido || profissionais.status !== 'sucesso') novosErros.profissional_id = 'Selecione um profissional com função compatível.';
        if (editando && infoEdicao?.status !== 'sucesso') {
            setErroEnvio('Aguarde a consulta das restrições da turma ou tente novamente.');
            return;
        }
        setErros(novosErros);
        setErroEnvio('');
        const primeiroErro = Object.keys(novosErros)[0];
        if (primeiroErro) {
            (form.querySelector(`[name="${primeiroErro}"]`) || form.querySelector('#turma-busca-profissional'))?.focus();
            return;
        }

        if (editando && !Object.keys(alterados).length) return;
        const dados = editando ? { ...alterados, ambiente_id: Number(formulario.ambiente_id) } : {
            tipo: formulario.tipo, nome: formulario.nome.trim(), turno: regular ? formulario.turno : faixa.turno,
            profissional_id: Number(formulario.profissional_id), descricao: formulario.descricao.trim() || null,
            ...(formulario.ambiente_id ? { ambiente_id: Number(formulario.ambiente_id) } : {}),
            ...(formulario.capacidade_maxima !== '' ? { capacidade_maxima: Number(formulario.capacidade_maxima) } : {}),
            ...(regular ? { ano_letivo: Number(formulario.ano_letivo) }
                : { hora_inicio: faixa.value, hora_fim: faixa.fim, dias_semana: [...formulario.dias_semana].sort((a, b) => a - b) }),
        };
        envioEmAndamento.current = true;
        setEnviando(true);
        try {
            if (editando) {
                const atualizada = await turmasService.editar(turma.id, dados);
                onSalvo(atualizada);
            } else {
                const criada = await turmasService.criar(dados);
                onCriado(criada);
            }
        } catch (error) {
            const errosCampos = {};
            for (const item of error.response?.data?.erros ?? []) {
                const campo = item.path?.[0];
                if (campo) errosCampos[['hora_inicio', 'hora_fim'].includes(campo) ? 'horario' : campo] = item.message;
            }
            setErros(errosCampos);
            setErroEnvio(error.response?.data?.erro || `Não foi possível ${editando ? 'editar' : 'cadastrar'}. Verifique os dados e tente novamente.`);
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
        <Modal testId="turma-formulario" isOpen onClose={fecharModal} title={editando ? (regular ? 'Editar Turma' : 'Editar Oficina') : 'Nova Turma / Oficina'}
            subtitle={<>Campos marcados com <span className="text-danger">*</span> são obrigatórios</>}
            confirmText={<span className="inline-flex items-center gap-sm">
                <SaveIcon />
                {editando ? 'Salvar alterações' : regular ? 'Salvar Turma' : 'Salvar Oficina'}
            </span>}
            confirmFormId="form-cadastro-turma" onConfirm={enviar} isConfirmLoading={enviando} isConfirmDisabled={incompleto}>
            <form id="form-cadastro-turma" onSubmit={enviar} noValidate>
                <fieldset disabled={enviando} className="min-w-0">
                    <SelecaoOpcao testId="turma-formulario-tipo" label="Tipo de turma" labelClassName="font-mono" name="tipo" required value={formulario.tipo} disabled={editando}
                        className="[&>div]:flex-col sm:[&>div]:flex-row" optionClassName="min-w-0"
                        onChange={(valor) => atualizarCampo('tipo', valor)} options={[
                            { value: 'REGULAR', title: 'Turma Regular', subtitle: 'Aulas diárias com cronograma fixo' },
                            { value: 'OFICINA', title: 'Oficina', subtitle: 'Aulas semanais' },
                        ]} />
                    {editando && !infoEdicao && <p role="status" className="mb-md text-sm text-slate-500">Consultando matrículas e histórico...</p>}
                    {editando && infoEdicao?.status === 'erro' && <div className="mb-md text-sm text-red-700"><p role="alert">Não foi possível consultar as restrições da turma.</p><button data-testid="turma-formulario-restricoes-tentar-novamente" type="button" className="underline" onClick={tentarNovamente}>Tentar novamente</button></div>}
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
                                <Input data-testid="turma-formulario-ano-letivo" id="turma-ano" label="Ano letivo" labelClassName="font-mono" name="ano_letivo" type="number" min="1" step="1" required disabled={agendaBloqueada}
                                    value={formulario.ano_letivo} onChange={(event) => atualizarCampo('ano_letivo', event.target.value)} {...acessibilidadeCampo('ano_letivo')} />
                                {erroCampo('ano_letivo')}
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
                                disabled={salas.status !== 'sucesso'} options={salas.dados.map((sala) => ({ value: sala.id, label: sala.nome }))} error={erros.ambiente_id} />
                            {salas.status === 'carregando' && <p role="status" className="mb-md text-xs text-text-muted">Carregando salas...</p>}
                            {salas.status === 'erro' && <div className="mb-md text-sm text-red-700"><p role="alert">{salas.erro}</p>
                                <button data-testid="turma-formulario-salas-tentar-novamente" type="button" onClick={tentarNovamente} className="mt-xs underline">Tentar novamente</button></div>}
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
                    <SeletorProfissional key={formulario.tipo} tipo={formulario.tipo} profissionais={elegiveis} value={formulario.profissional_id}
                        onChange={(valor) => atualizarCampo('profissional_id', valor)} carregando={profissionais.status === 'carregando'}
                        erroCarga={profissionais.erro} onTentarNovamente={tentarNovamente} error={erros.profissional_id} />
                    {erroEnvio && <p role="alert" className="mt-md rounded-sm bg-red-50 p-sm text-sm text-red-700">{erroEnvio}</p>}
                </fieldset>
            </form>
        </Modal>
    );
}
