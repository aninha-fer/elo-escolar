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

const faixasOficina = [
    { value: '08:15', label: 'Manhã: 08:15 – 09:15', turno: 'MANHA', fim: '09:15' },
    { value: '09:45', label: 'Manhã: 09:45 – 11:00', turno: 'MANHA', fim: '11:00' },
    { value: '13:30', label: 'Tarde: 13:30 – 14:45', turno: 'TARDE', fim: '14:45' },
    { value: '15:15', label: 'Tarde: 15:15 – 16:30', turno: 'TARDE', fim: '16:30' },
];
const diasSemana = [1, 2, 3, 4, 5].map((value, indice) => ({ value, label: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'][indice] }));

export function FormularioTurma({ tipoInicial = 'REGULAR', onClose, onCriado }) {
    const envioEmAndamento = useRef(false);
    const [enviando, setEnviando] = useState(false);
    const [formulario, setFormulario] = useState(() => ({
        tipo: tipoInicial, nome: '', turno: 'MANHA', horario: '', dias_semana: [], ambiente_id: '',
        capacidade_maxima: '', descricao: '', profissional_id: '',
        ano_letivo: new Intl.DateTimeFormat('pt-BR', { year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date()),
    }));
    const [erros, setErros] = useState({});
    const [erroEnvio, setErroEnvio] = useState('');
    const [profissionais, setProfissionais] = useState({ status: 'carregando', dados: [] });
    const [salas, setSalas] = useState({ status: 'carregando', dados: [] });
    const [tentativa, setTentativa] = useState(0);

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
    const elegiveis = profissionais.dados.filter((profissional) => cargosPermitidos.includes(profissional.funcao?.trim().toLocaleLowerCase('pt-BR')));
    const faixa = faixasOficina.find((opcao) => opcao.value === formulario.horario);
    const profissionalValido = elegiveis.some((profissional) => profissional.id === Number(formulario.profissional_id));
    const incompleto = !formulario.nome.trim() || !profissionalValido || profissionais.status !== 'sucesso'
        || (regular ? !formulario.ano_letivo : !faixa || formulario.dias_semana.length === 0);

    function tentarNovamente() {
        setProfissionais({ status: 'carregando', dados: [] });
        setSalas({ status: 'carregando', dados: [] });
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
        if (regular && !['MANHA', 'TARDE'].includes(formulario.turno)) novosErros.turno = 'Selecione um período.';
        if (regular && (!formulario.ano_letivo || !Number.isInteger(Number(formulario.ano_letivo)) || Number(formulario.ano_letivo) < 1)) {
            novosErros.ano_letivo = 'Informe um ano letivo inteiro e positivo.';
        }
        if (!regular && !faixa) novosErros.horario = 'Selecione um horário para a oficina.';
        if (!regular && (!formulario.dias_semana.length || formulario.dias_semana.some((dia) => ![1, 2, 3, 4, 5].includes(dia)))) {
            novosErros.dias_semana = 'Selecione ao menos um dia de segunda a sexta.';
        }
        if (formulario.capacidade_maxima !== '' && (!Number.isInteger(Number(formulario.capacidade_maxima)) || Number(formulario.capacidade_maxima) < 0)) {
            novosErros.capacidade_maxima = 'Informe um número inteiro de vagas, igual ou maior que zero.';
        }
        if (formulario.ambiente_id && (salas.status !== 'sucesso' || !salas.dados.some((sala) => sala.id === Number(formulario.ambiente_id)))) {
            novosErros.ambiente_id = 'Selecione uma sala disponível ou deixe sem definição.';
        }
        if (!profissionalValido || profissionais.status !== 'sucesso') novosErros.profissional_id = 'Selecione um profissional com função compatível.';
        setErros(novosErros);
        setErroEnvio('');
        const primeiroErro = Object.keys(novosErros)[0];
        if (primeiroErro) {
            (form.querySelector(`[name="${primeiroErro}"]`) || form.querySelector('#turma-busca-profissional'))?.focus();
            return;
        }

        const dados = {
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
            const turma = await turmasService.criar(dados);
            onCriado(turma);
        } catch (error) {
            const errosCampos = {};
            for (const item of error.response?.data?.erros ?? []) {
                const campo = item.path?.[0];
                if (campo) errosCampos[['hora_inicio', 'hora_fim'].includes(campo) ? 'horario' : campo] = item.message;
            }
            setErros(errosCampos);
            setErroEnvio(error.response?.data?.erro || 'Não foi possível cadastrar. Verifique os dados e tente novamente.');
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
        <Modal isOpen onClose={fecharModal} title="Nova Turma / Oficina"
            subtitle={<>Campos marcados com <span className="text-danger">*</span> são obrigatórios</>}
            confirmText={<span className="inline-flex items-center gap-sm">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z" /><path d="M7 3v6h10V3M7 21v-8h10v8" /></svg>
                {regular ? 'Salvar Turma' : 'Salvar Oficina'}
            </span>}
            confirmFormId="form-cadastro-turma" onConfirm={enviar} isConfirmLoading={enviando} isConfirmDisabled={incompleto}>
            <form id="form-cadastro-turma" onSubmit={enviar} noValidate>
                <fieldset disabled={enviando} className="min-w-0">
                    <SelecaoOpcao label="Tipo de turma" labelClassName="font-mono" name="tipo" required value={formulario.tipo}
                        className="[&>div]:flex-col sm:[&>div]:flex-row" optionClassName="min-w-0"
                        onChange={(valor) => atualizarCampo('tipo', valor)} options={[
                            { value: 'REGULAR', title: 'Turma Regular', subtitle: 'Aulas diárias com cronograma fixo' },
                            { value: 'OFICINA', title: 'Oficina', subtitle: 'Aulas semanais' },
                        ]} />
                    <Input id="turma-nome" label="Nome" labelClassName="font-mono" name="nome" required
                        value={formulario.nome} onChange={(event) => atualizarCampo('nome', event.target.value)}
                        placeholder={regular ? 'Ex: Turma Girassol' : 'Ex: Oficina de Artes'} {...acessibilidadeCampo('nome')} />
                    {erroCampo('nome')}
                    {regular ? <>
                        <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
                            <div className="sm:col-span-2">
                                <SelecaoOpcao label="Período" labelClassName="font-mono" name="turno" required value={formulario.turno}
                                    onChange={(valor) => atualizarCampo('turno', valor)} options={[{ value: 'MANHA', title: 'Manhã' }, { value: 'TARDE', title: 'Tarde' }]} />
                                {erroCampo('turno')}
                            </div>
                            <div>
                                <Input id="turma-ano" label="Ano letivo" labelClassName="font-mono" name="ano_letivo" type="number" min="1" step="1" required
                                    value={formulario.ano_letivo} onChange={(event) => atualizarCampo('ano_letivo', event.target.value)} {...acessibilidadeCampo('ano_letivo')} />
                                {erroCampo('ano_letivo')}
                            </div>
                        </div>
                        <div className="mb-lg rounded-sm border border-blue-100 bg-blue-50 p-md">
                            <h3 className="mb-sm font-mono text-xs font-semibold uppercase tracking-wider text-blue-600">Cronograma fixo (gerado automaticamente)</h3>
                            {formulario.turno === 'MANHA' ? <dl className="grid grid-cols-[1fr_auto] gap-x-sm gap-y-xs text-sm">
                                <dt>Seg, Ter, Qui, Sex</dt><dd className="font-mono text-blue-600">07:30 – 11:30</dd>
                                <dt>Quarta</dt><dd className="font-mono text-blue-600">12:30 – 16:30</dd>
                            </dl> : <dl className="grid grid-cols-[1fr_auto] gap-sm text-sm"><dt>Segunda a sexta</dt><dd className="font-mono text-blue-600">12:30 – 16:30</dd></dl>}
                        </div>
                    </> : <>
                        <Select id="turma-horario" label="Horário" labelClassName="font-mono" name="horario" required placeholder="Selecione um horário"
                            options={faixasOficina} value={formulario.horario} onChange={(event) => atualizarCampo('horario', event.target.value)} error={erros.horario} />
                        <SelecaoDiasSemana label="Dia(s) da semana" labelClassName="font-mono" name="dias_semana" required
                            value={formulario.dias_semana} options={diasSemana} allowSelectAll={false} containerClassName="grid! grid-cols-5 gap-xs!"
                            onChange={(valor) => atualizarCampo('dias_semana', valor)} />
                        {erroCampo('dias_semana')}
                    </>}
                    <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
                        <div>
                            <Select id="turma-sala" label="Sala / ambiente" labelClassName="font-mono" name="ambiente_id" placeholder="— Não definida —"
                                value={formulario.ambiente_id} onChange={(event) => atualizarCampo('ambiente_id', event.target.value)}
                                disabled={salas.status !== 'sucesso'} options={salas.dados.map((sala) => ({ value: sala.id, label: sala.nome }))} error={erros.ambiente_id} />
                            {salas.status === 'carregando' && <p role="status" className="mb-md text-xs text-text-muted">Carregando salas...</p>}
                            {salas.status === 'erro' && <div className="mb-md text-sm text-red-700"><p role="alert">{salas.erro}</p>
                                <button type="button" onClick={tentarNovamente} className="mt-xs underline">Tentar novamente</button></div>}
                        </div>
                        <div>
                            <Input id="turma-vagas" label="Vagas" labelClassName="font-mono" name="capacidade_maxima" type="number" min="0" step="1" placeholder="Ex: 12"
                                value={formulario.capacidade_maxima} onChange={(event) => atualizarCampo('capacidade_maxima', event.target.value)} {...acessibilidadeCampo('capacidade_maxima')} />
                            {erroCampo('capacidade_maxima')}
                        </div>
                    </div>
                    <div className="mb-lg">
                        <label htmlFor="turma-descricao" className="mb-sm block font-mono text-xs font-semibold uppercase tracking-wider text-slate-600">Descrição</label>
                        <textarea id="turma-descricao" name="descricao" rows={3} placeholder="Breve descrição da turma ou oficina..."
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
