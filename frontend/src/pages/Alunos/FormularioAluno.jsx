import { ConteudoBotao } from '../../components/ConteudoBotao';
import { useToast } from '../../contexts/ToastContext';
import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { ModalConfirmacao } from '../../components/ModalConfirmacao';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Toggle } from '../../components/Toggle';
import { SelecaoOpcao } from '../../components/SelecaoOpcao';
import { SelecaoDiasSemana } from '../../components/SelecaoDiasSemana';
import { alunoService } from '../../services/alunoService';
import { turmasService } from '../../services/turmasService';
import { formatarTurno } from '../../utils/formatters';
import { SaveIcon } from '../../components/icons/SaveIcon';
const formularioInicial = {
    nome: '',
    telefone: '',
    data_nascimento: '',
    responsaveis: [],
    participa_procan: false,
    observacoes: '',
    dados_medicos: {
        restricao_alimentar: '', autorizado_atividade_fisica: '', usa_medicamento: '',
        medicamentos_descricao: '', autorizacao_analgesico: '',
    },
    turno: '',
    dias_frequencia: [],
    participa_almoco: false,
    turma_id: '',
};

export function FormularioAluno({ aluno, onClose, onSalvo }) {
    const { notificar } = useToast();
    const editando = Boolean(aluno);
    const turmaAtual = aluno?.turma_regular;
    const [formulario, setFormulario] = useState(() => aluno ? {
        ...formularioInicial, ...aluno, nome: aluno.pessoa.nome, telefone: aluno.pessoa.telefone ?? '',
        data_nascimento: aluno.pessoa.data_nascimento?.slice(0, 10) ?? '',
        observacoes: aluno.observacoes ?? '', turma_id: String(aluno.turma_regular?.id ?? ''),
        responsaveis: aluno.responsaveis.map((r) => ({ ...r, chave: r.id, telefone: r.telefone ?? '', parentesco: r.parentesco ?? '' })),
        dados_medicos: {
            ...formularioInicial.dados_medicos, ...aluno.dados_medicos,
            restricao_alimentar: aluno.dados_medicos?.restricao_alimentar ?? '', medicamentos_descricao: aluno.dados_medicos?.medicamentos_descricao ?? '',
            autorizacao_analgesico: aluno.dados_medicos?.autorizacao_analgesico ?? '',
            autorizado_atividade_fisica: aluno.dados_medicos?.autorizado_atividade_fisica == null ? '' : String(aluno.dados_medicos.autorizado_atividade_fisica),
            usa_medicamento: aluno.dados_medicos?.usa_medicamento == null ? '' : String(aluno.dados_medicos.usa_medicamento)
        }
    } : formularioInicial);
    const [turmas, setTurmas] = useState([]);
    const [carregandoTurmas, setCarregandoTurmas] = useState(true);
    const [erroTurmas, setErroTurmas] = useState('');
    const [tentativa, setTentativa] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [acaoEnvio, setAcaoEnvio] = useState(null);
    const [submitError, setSubmitError] = useState('');
    const [erros, setErros] = useState({});
    const [conflitos, setConflitos] = useState([]);
    const [confirmacao, setConfirmacao] = useState(null);
    const sequenciaResponsavel = useRef(-1);
    const enviando = useRef(false);
    useEffect(() => {
        const controller = new AbortController();
        turmasService.listarTurmasRegularesPorTurno(controller.signal).then((dados) => {
            if (!controller.signal.aborted) { setTurmas(dados); setErroTurmas(''); }
        }).catch(() => { if (!controller.signal.aborted) setErroTurmas('Não foi possível carregar as turmas.'); })
            .finally(() => { if (!controller.signal.aborted) setCarregandoTurmas(false); });
        return () => controller.abort();
    }, [tentativa]);
    function atualizarCampo(campo, valor) {
        setFormulario((atual) => ({
            ...atual,
            [campo]: valor,
            ...(campo === 'turno' ? { turma_id: '' } : {}),
        }));
        limparErros(campo, ...(campo === 'turno' ? ['turma_id'] : []));
    }

    function adicionarResponsavel() {
        const chave = sequenciaResponsavel.current--;
        setFormulario((atual) => ({ ...atual, responsaveis: [...atual.responsaveis, { chave, nome: '', parentesco: '', telefone: '' }] }));
    }

    function atualizarResponsavel(chave, campo, valor) {
        setFormulario((atual) => ({
            ...atual, responsaveis: atual.responsaveis.map((responsavel) =>
                responsavel.chave === chave ? { ...responsavel, [campo]: valor } : responsavel)
        }));
        limparErros(`responsaveis.${chave}.${campo}`);
    }

    function removerResponsavel(chave) {
        setFormulario((atual) => ({ ...atual, responsaveis: atual.responsaveis.filter((responsavel) => responsavel.chave !== chave) }));
        setErros((atuais) => Object.fromEntries(Object.entries(atuais).filter(([campo]) => !campo.startsWith(`responsaveis.${chave}.`))));
    }

    function atualizarDadoMedico(campo, valor) {
        setFormulario((atual) => ({
            ...atual, dados_medicos: {
                ...atual.dados_medicos, [campo]: valor,
                ...(campo === 'usa_medicamento' && valor !== 'true' ? { medicamentos_descricao: '' } : {}),
            }
        }));
        limparErros(`dados_medicos.${campo}`, ...(campo === 'usa_medicamento' ? ['dados_medicos.medicamentos_descricao'] : []));
    }

    function limparErros(...campos) {
        setErros((atuais) => Object.fromEntries(Object.entries(atuais).filter(([campo]) => !campos.includes(campo))));
    }

    function focarPrimeiroErro(novosErros) {
        requestAnimationFrame(() => {
            const campo = [...document.querySelectorAll('#form-cadastro-aluno [data-campo]')]
                .find((elemento) => novosErros[elemento.dataset.campo]);
            if (!campo) return;
            campo.scrollIntoView({ block: 'center', behavior: 'smooth' });
            campo.querySelector('input, select, textarea, button')?.focus({ preventScroll: true });
        });
    }

    function acessibilidadeCampo(campo) {
        return { 'aria-invalid': Boolean(erros[campo]), 'aria-describedby': erros[campo] ? `aluno-${campo}-erro` : undefined };
    }

    function campoComErro(campo, controle, erroInterno = false, className = '') {
        const grupo = ['turno', 'dias_frequencia', 'participa_procan', 'participa_almoco'].includes(campo);
        return <div className={`min-w-0 w-full ${className}`.trim()} data-campo={campo} role={grupo ? 'group' : undefined}
            {...(grupo ? acessibilidadeCampo(campo) : {})}>
            {controle}
            {!erroInterno && erros[campo] && <p id={`aluno-${campo}-erro`} className="mb-md text-sm text-red-700">{erros[campo]}</p>}
        </div>;
    }

    function fecharModal() {
        if (enviando.current) return;
        onClose();
    }

    function normalizarTelefone(telefone) {
        return telefone.replace(/\D/g, '');
    }

    async function salvarAluno(status, confirmacao) {
        if (enviando.current) return;

        const nome = formulario.nome.trim();
        const telefone = normalizarTelefone(formulario.telefone);
        const responsaveisComChave = formulario.responsaveis.map((responsavel) => ({
            chave: responsavel.chave,
            ...(responsavel.id ? { id: responsavel.id } : {}), nome: responsavel.nome.trim(), parentesco: responsavel.parentesco.trim(),
            telefone: normalizarTelefone(responsavel.telefone),
        })).filter((responsavel) => responsavel.nome || responsavel.parentesco || responsavel.telefone);
        const responsaveis = responsaveisComChave.map((responsavel) => {
            const dados = { ...responsavel };
            delete dados.chave;
            return dados;
        });
        const novosErros = {};
        setSubmitError('');
        setConflitos([]);

        if (!nome) {
            novosErros.nome = 'Informe o nome do aluno.';
        }

        if (!formulario.turno) novosErros.turno = 'Selecione o período.';
        if (formulario.dias_frequencia.length === 0) novosErros.dias_frequencia = 'Selecione ao menos um dia de frequência.';

        if (telefone && !/^\d{10,11}$/.test(telefone)) novosErros.telefone = 'O telefone deve conter DDD e ter 10 ou 11 dígitos.';
        for (const responsavel of responsaveisComChave) {
            const prefixo = `responsaveis.${responsavel.chave}`;
            if (responsavel.nome.length < 2) novosErros[`${prefixo}.nome`] = 'Informe o nome do responsável, com pelo menos 2 caracteres.';
            if (responsavel.parentesco.length > 30) novosErros[`${prefixo}.parentesco`] = 'O parentesco deve ter no máximo 30 caracteres.';
            if (responsavel.telefone && !/^\d{10,11}$/.test(responsavel.telefone)) novosErros[`${prefixo}.telefone`] = 'O telefone deve conter DDD e ter 10 ou 11 dígitos.';
        }
        const medicos = formulario.dados_medicos;
        if (medicos.usa_medicamento === 'true' && !medicos.medicamentos_descricao.trim()) {
            novosErros['dados_medicos.medicamentos_descricao'] = 'Informe qual medicamento o aluno utiliza.';
        }
        const booleanoOpcional = (valor) => valor === '' ? null : valor === 'true';

        const turmaSelecionada = turmas.find((turma) => turma.id === Number(formulario.turma_id));

        if (status === 'ATIVO' && turmaSelecionada && turmaSelecionada.id !== aluno?.turma_regular?.id && turmaSelecionada.capacidade_maxima != null && turmaSelecionada.vagas_disponiveis === 0) {
            novosErros.turma_id = 'A turma regular está sem vagas disponíveis.';
        }
        setErros(novosErros);
        if (Object.keys(novosErros).length) {
            focarPrimeiroErro(novosErros);
            return;
        }

        const dadosAluno = {
            nome,
            telefone: telefone || (editando ? null : undefined),
            data_nascimento: formulario.data_nascimento || (editando ? null : undefined),
            responsaveis,
            participa_procan: formulario.participa_procan,
            observacoes: formulario.observacoes.trim() || null,
            dados_medicos: {
                restricao_alimentar: medicos.restricao_alimentar.trim() || null,
                autorizado_atividade_fisica: booleanoOpcional(medicos.autorizado_atividade_fisica),
                usa_medicamento: booleanoOpcional(medicos.usa_medicamento),
                medicamentos_descricao: medicos.usa_medicamento === 'true' ? medicos.medicamentos_descricao.trim() : null,
                autorizacao_analgesico: medicos.autorizacao_analgesico || null,
            },
            turno: formulario.turno,
            dias_frequencia: formulario.dias_frequencia,
            participa_almoco: formulario.participa_almoco,
            status,
            ...(formulario.turma_id ? { turma_id: Number(formulario.turma_id) } : editando ? { turma_id: null } : {}),
        };

        try {
            enviando.current = true;
            setAcaoEnvio(status === 'RASCUNHO' ? 'rascunho' : 'principal');
            setIsSubmitting(true);
            setSubmitError('');
            if (editando) {
                const campos = { ...dadosAluno };
                delete campos.status;
                const dados = {
                    ...campos, ...(aluno.status === 'RASCUNHO' ? { status } : {}),
                    ...(confirmacao ? { confirmar_cancelamentos: confirmacao } : {})
                };
                await alunoService.editar(aluno.id, dados);
            } else await alunoService.criarAluno(dadosAluno);
            notificar(editando ? 'Aluno atualizado com sucesso.' : status === 'RASCUNHO' ? 'Rascunho salvo com sucesso.' : 'Aluno cadastrado com sucesso.', 'sucesso');
            onSalvo();
        } catch (err) {
            if (err.response?.data?.confirmacao) {
                setConfirmacao({ assinatura: err.response.data.confirmacao, conflitos: err.response.data.conflitos, status });
                return;
            }
            setConfirmacao(null);
            setConflitos(err.response?.data?.conflitos ?? []);
            const errosCampos = {};
            const mensagensGerais = [];
            for (const item of err.response?.data?.erros ?? []) {
                const caminho = [...(item.path ?? [])];
                if (caminho[0] === 'responsaveis' && Number.isInteger(caminho[1])) {
                    const responsavel = responsaveisComChave[caminho[1]];
                    if (!responsavel) { mensagensGerais.push(item.message); continue; }
                    caminho[1] = responsavel.chave;
                }
                const campo = caminho.join('.');
                const existe = (caminho.length === 1 && Object.hasOwn(formularioInicial, campo) && !['responsaveis', 'dados_medicos'].includes(campo))
                    || (caminho[0] === 'dados_medicos' && caminho.length === 2 && Object.hasOwn(formularioInicial.dados_medicos, caminho[1]))
                    || (caminho[0] === 'responsaveis' && caminho.length === 3 && ['nome', 'telefone', 'parentesco'].includes(caminho[2]));
                if (existe) errosCampos[campo] ??= item.message;
                else mensagensGerais.push(item.message);
            }
            setErros(errosCampos);
            focarPrimeiroErro(errosCampos);
            const mensagemErro = err.response?.data?.erro || mensagensGerais.join(' ') || (Object.keys(errosCampos).length ? '' : 'Não foi possível salvar o aluno.');
            if (err.response?.data?.conflitos?.length) setSubmitError(mensagemErro);
            else if (!Object.keys(errosCampos).length || mensagensGerais.length) notificar(mensagemErro);
        } finally {
            enviando.current = false;
            setIsSubmitting(false);
            setAcaoEnvio(null);
        }
    }

    function handleSubmit(event) {
        event.preventDefault();
        salvarAluno(editando ? aluno.status === 'RASCUNHO' ? 'ATIVO' : aluno.status : 'ATIVO');
    }

    function salvarRascunho() {
        salvarAluno('RASCUNHO');
    }


    return (<>
        <Modal testId="aluno-formulario" isOpen={!confirmacao}
            onClose={fecharModal}
            title={editando ? 'Editar Aluno' : 'Cadastrar Novo Aluno'}
            subtitle="Campos com * são obrigatórios para o cadastro"
            confirmText={<span className="inline-flex items-center gap-sm">
                <SaveIcon />
                {editando ? aluno.status === 'RASCUNHO' ? 'Salvar e ativar' : 'Salvar alterações' : 'Salvar Aluno'}
            </span>}
            cancelText="Cancelar"
            secondaryText={!editando || aluno.status === 'RASCUNHO' ? 'Salvar rascunho' : undefined}
            onSecondaryAction={!editando || aluno.status === 'RASCUNHO' ? salvarRascunho : undefined}
            confirmFormId="form-cadastro-aluno"
            onConfirm={handleSubmit}
            isConfirmLoading={isSubmitting && acaoEnvio !== 'rascunho'}
            isSecondaryLoading={isSubmitting && acaoEnvio === 'rascunho'}>
            {erroTurmas && <div role="alert" className="mb-md text-sm text-red-700">{erroTurmas} <button data-testid="aluno-formulario-turmas-tentar-novamente" type="button" className="underline" disabled={carregandoTurmas} onClick={() => { setCarregandoTurmas(true); setTentativa((v) => v + 1); }}><ConteudoBotao carregando={carregandoTurmas}>Tentar novamente</ConteudoBotao></button></div>}
            <form id="form-cadastro-aluno" onSubmit={handleSubmit} noValidate>
                <fieldset disabled={isSubmitting} className="min-w-0">
                    <div className="mb-md border-b border-gray-200 pb-sm">
                        <h3 className="text-sm font-semibold text-text-main">Dados pessoais</h3>
                    </div>
                    {campoComErro('nome', (<Input data-testid="aluno-formulario-nome"
                        id="nome-aluno"
                        name="nome"
                        type="text"
                        label="Nome Completo"
                        placeholder="Ex: Lucas Andrade"
                        value={formulario.nome}
                        onChange={(event) => atualizarCampo('nome', event.target.value)}
                        required
                        {...acessibilidadeCampo('nome')} />))}
                    <div className="flex flex-row gap-md">
                        {campoComErro('telefone', (<Input data-testid="aluno-formulario-telefone"
                            id="telefone-aluno"
                            name="telefone"
                            type="tel"
                            label="Telefone"
                            placeholder="(00) 0 0000-0000"
                            value={formulario.telefone}
                            onChange={(event) => atualizarCampo('telefone', event.target.value)}
                            {...acessibilidadeCampo('telefone')} />))}
                        {campoComErro('data_nascimento', (<Input data-testid="aluno-formulario-data-nascimento"
                            id="data-nascimento-aluno"
                            name="data_nascimento"
                            type="date"
                            label="Data de nascimento"
                            value={formulario.data_nascimento}
                            onChange={(event) => atualizarCampo('data_nascimento', event.target.value)}
                            {...acessibilidadeCampo('data_nascimento')} />))}
                    </div>
                    {campoComErro('participa_procan', (<Toggle testId="aluno-formulario-procan" label="Procan" name="participa_procan" checked={formulario.participa_procan}
                        onChange={(valor) => atualizarCampo('participa_procan', valor)} />))}
                    <div className="mb-md">
                        <label htmlFor="observacoes-aluno" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600">Observações</label>
                        {campoComErro('observacoes', (<textarea data-testid="aluno-formulario-observacoes" id="observacoes-aluno" name="observacoes" rows={3}
                            placeholder="Informações importantes sobre o aluno, sua rotina ou comportamento"
                            value={formulario.observacoes} onChange={(event) => atualizarCampo('observacoes', event.target.value)}
                            className="w-full resize-y rounded-sm border border-slate-200 bg-bg-surface p-sm text-text-main placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-secondary" {...acessibilidadeCampo('observacoes')} />))}
                    </div>
                    <div className="mb-md flex items-center justify-between gap-sm border-b border-gray-200 pb-sm">
                        <h3 className="text-sm font-semibold text-text-main">Responsáveis <span className="font-normal text-text-muted">(opcional)</span></h3>
                        <button data-testid="aluno-formulario-adicionar-responsavel" type="button" onClick={adicionarResponsavel}
                            className="rounded-sm border border-slate-200 px-sm py-xs text-xs font-semibold text-text-main hover:bg-bg-main">+ Adicionar responsável</button>
                    </div>
                    {formulario.responsaveis.map((responsavel, indice) => (
                        <div key={responsavel.chave} className="mb-md flex items-start gap-sm rounded-md border border-slate-200 bg-bg-main p-sm">
                            <span className="mt-7 flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-secondary">{indice + 1}</span>
                            <div className="grid min-w-0 flex-1 grid-cols-1 gap-sm sm:grid-cols-3">
                                {campoComErro(`responsaveis.${responsavel.chave}.nome`, (<Input data-testid={`aluno-formulario-responsavel-${responsavel.chave}-nome`} id={`responsavel-${responsavel.chave}-nome`} name={`responsaveis.${responsavel.chave}.nome`}
                                    label={`Nome do responsável`} placeholder="Ex: Roberto Andrade"
                                    value={responsavel.nome} onChange={(event) => atualizarResponsavel(responsavel.chave, 'nome', event.target.value)} {...acessibilidadeCampo(`responsaveis.${responsavel.chave}.nome`)} />))}
                                {campoComErro(`responsaveis.${responsavel.chave}.parentesco`, (<Input data-testid={`aluno-formulario-responsavel-${responsavel.chave}-parentesco`} id={`responsavel-${responsavel.chave}-parentesco`} name={`responsaveis.${responsavel.chave}.parentesco`}
                                    label="Parentesco" placeholder="Ex: Mãe" maxLength={30}
                                    value={responsavel.parentesco} onChange={(event) => atualizarResponsavel(responsavel.chave, 'parentesco', event.target.value)} {...acessibilidadeCampo(`responsaveis.${responsavel.chave}.parentesco`)} />))}
                                {campoComErro(`responsaveis.${responsavel.chave}.telefone`, (<Input data-testid={`aluno-formulario-responsavel-${responsavel.chave}-telefone`} id={`responsavel-${responsavel.chave}-telefone`} name={`responsaveis.${responsavel.chave}.telefone`}
                                    label="Telefone" type="tel" placeholder="(00) 0 0000-0000"
                                    value={responsavel.telefone} onChange={(event) => atualizarResponsavel(responsavel.chave, 'telefone', event.target.value)} {...acessibilidadeCampo(`responsaveis.${responsavel.chave}.telefone`)} />))}
                            </div>
                            <button data-testid={`aluno-formulario-responsavel-${responsavel.chave}-remover`} type="button" aria-label={`Remover responsável ${indice + 1}`} onClick={() => removerResponsavel(responsavel.chave)}
                                className="mt-7 rounded-sm border border-slate-200 px-2 py-1 text-xs text-text-muted hover:bg-bg-surface">×</button>
                        </div>
                    ))}
                    <div className="mb-md border-b border-gray-200 pb-sm">
                        <h3 className="text-sm font-semibold text-text-main">Saúde e cuidados <span className="font-normal text-text-muted">(opcional)</span></h3>
                    </div>
                    <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
                        {campoComErro('dados_medicos.restricao_alimentar', (<Input data-testid="aluno-formulario-restricao-alimentar" id="restricao-alimentar" name="restricao_alimentar" label="Restrição alimentar" placeholder="Ex: intolerância à lactose"
                            value={formulario.dados_medicos.restricao_alimentar} onChange={(event) => atualizarDadoMedico('restricao_alimentar', event.target.value)} {...acessibilidadeCampo('dados_medicos.restricao_alimentar')} />))}
                        {campoComErro('dados_medicos.autorizado_atividade_fisica', (<Select data-testid="aluno-formulario-atividade-fisica" id="atividade-fisica" name="autorizado_atividade_fisica" label="Autorização para atividade física" placeholder="— Não informado —"
                            value={formulario.dados_medicos.autorizado_atividade_fisica} onChange={(event) => atualizarDadoMedico('autorizado_atividade_fisica', event.target.value)}
                            options={[{ value: 'true', label: 'Autorizado' }, { value: 'false', label: 'Não autorizado' }]} error={erros['dados_medicos.autorizado_atividade_fisica']} />), true)}
                        {campoComErro('dados_medicos.usa_medicamento', (<Select data-testid="aluno-formulario-usa-medicamento" id="usa-medicamento" name="usa_medicamento" label="Uso de medicamento" placeholder="— Não informado —"
                            value={formulario.dados_medicos.usa_medicamento} onChange={(event) => atualizarDadoMedico('usa_medicamento', event.target.value)}
                            options={[{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }]} error={erros['dados_medicos.usa_medicamento']} />), true)}
                        {campoComErro('dados_medicos.autorizacao_analgesico', (<Select data-testid="aluno-formulario-autorizacao-analgesico" id="autorizacao-analgesico" name="autorizacao_analgesico" label="Em caso de dor" placeholder="— Não informado —"
                            value={formulario.dados_medicos.autorizacao_analgesico} onChange={(event) => atualizarDadoMedico('autorizacao_analgesico', event.target.value)}
                            options={[
                                { value: 'NENHUM', label: 'Nenhum' }, { value: 'PARACETAMOL', label: 'Paracetamol' },
                                { value: 'DIPIRONA', label: 'Dipirona' }, { value: 'AMBOS', label: 'Ambos' },
                            ]} error={erros['dados_medicos.autorizacao_analgesico']} />), true)}
                    </div>
                    {formulario.dados_medicos.usa_medicamento === 'true' && (
                        campoComErro('dados_medicos.medicamentos_descricao', (<Input data-testid="aluno-formulario-medicamentos-descricao" id="medicamentos-descricao" name="medicamentos_descricao" label="Qual medicamento?" placeholder="Nome e dosagem, se houver" required
                            value={formulario.dados_medicos.medicamentos_descricao} onChange={(event) => atualizarDadoMedico('medicamentos_descricao', event.target.value)} {...acessibilidadeCampo('dados_medicos.medicamentos_descricao')} />))
                    )}
                    <div className="border-gray-200 border-b w-full py-sm mb-md">
                        <h3 className="font-semibold text-[14px] text-text-main px-1">Frequência</h3>
                    </div>
                    {campoComErro('turno', (<SelecaoOpcao testId="aluno-formulario-turno"
                        label="Período"
                        name="turno"
                        required
                        value={formulario.turno}
                        onChange={(valor) => atualizarCampo('turno', valor)}
                        options={[
                            { value: 'MANHA', title: 'Manhã' },
                            { value: 'TARDE', title: 'Tarde' },
                        ]}
                    />))}
                    {campoComErro('dias_frequencia', (<SelecaoDiasSemana testId="aluno-formulario-frequencia"
                        name="dias_frequencia" label="Dias de frequência"
                        required
                        value={formulario.dias_frequencia}
                        onChange={(dias) => atualizarCampo('dias_frequencia', dias)}
                        options={[
                            { value: 1, label: 'Seg' },
                            { value: 2, label: 'Ter' },
                            { value: 3, label: 'Qua' },
                            { value: 4, label: 'Qui' },
                            { value: 5, label: 'Sex' },
                            { value: 'TODOS', label: 'Todos' },
                        ]}
                    />))}
                    <div className="flex flex-col gap-md sm:flex-row sm:items-start sm:justify-between">
                        {campoComErro('participa_almoco', (<Toggle testId="aluno-formulario-almoco"
                            label="Participa do almoço?"
                            name="participa_almoco"
                            checked={formulario.participa_almoco}
                            onChange={(valor) => atualizarCampo('participa_almoco', valor)}
                        />))}
                        {campoComErro('turma_id', (<Select data-testid="aluno-formulario-turma-regular"
                            label="Turma regular"
                            name="turma_id" loading={carregandoTurmas} loadingLabel="Carregando turmas regulares..."
                            value={formulario.turma_id}
                            onChange={(event) => atualizarCampo('turma_id', event.target.value)}
                            placeholder="Sem turma regular"
                            disabled={!formulario.turno || aluno?.status === 'INATIVO'}
                            options={[
                                ...(turmaAtual && turmaAtual.turno === formulario.turno && !turmas.some((turma) => turma.id === turmaAtual.id)
                                    ? [{ value: turmaAtual.id, label: `${turmaAtual.nome} — ${turmaAtual.status === 'INATIVO' ? 'Inativa' : 'Vínculo atual'}`, disabled: true }] : []),
                                ...turmas
                                .filter((turma) => turma.turno === formulario.turno)
                                .map((turma) => ({
                                    value: turma.id,
                                    label: `${turma.nome} - ${formatarTurno(turma.turno)}${turma.capacidade_maxima == null ? ' — Sem limite' : turma.vagas_disponiveis === 0 ? ' — Lotada: rascunho não reserva vaga' : ''}`,
                                })),
                            ]}
                            error={erros['turma_id']} />), true, 'sm:ml-30')}
                    </div>
                    {(submitError || conflitos.length > 0) && (
                        <div role="alert" className="mb-md rounded-sm bg-red-50 p-sm text-sm text-red-700">
                            {submitError && <p>{submitError}</p>}
                            {conflitos.length > 0 && <ul className="mt-sm list-disc pl-lg">{conflitos.map((c, i) => <li key={i}>{c.mensagem || c.codigo || String(c)}</li>)}</ul>}
                        </div>
                    )}
                    {(!editando || aluno.status === 'RASCUNHO') && <div className="w-full rounded-md border border-tertiary bg-tertiary/10 p-md text-[12px] text-[#92400E]">
                        <h3 className="text-[14px] font-semibold">Salvar como rascunho</h3>
                        <p>Informe nome, período e dias de frequência. A turma regular é opcional para o rascunho e não reserva vaga.</p>
                    </div>}
                </fieldset>
            </form>
        </Modal>
        <ModalConfirmacao testId="aluno-alterar-periodo" isOpen={Boolean(confirmacao)} onClose={() => { if (!enviando.current) setConfirmacao(null); }}
            title="Alterar período do aluno?" estado="atencao" showCancel confirmText="Alterar período e encerrar vínculos"
            description={<>As matrículas e os atendimentos abaixo serão encerrados para evitar conflitos de turno:
                <span className="mt-xs block">{confirmacao?.conflitos?.map((c) => c.mensagem).join(', ')}</span>
            </>} isConfirmLoading={isSubmitting} onConfirm={() => salvarAluno(confirmacao.status, confirmacao.assinatura)} />
    </>);
}
