import { useRef, useState } from 'react';
import { z } from 'zod';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { SelecaoOpcao } from '../../components/SelecaoOpcao';
import { usuariosService } from '../../services/usuariosService';
import { SeletorFuncionario } from './SeletorFuncionario';

const formularioInicial = { modo: 'nova', nome: '', pessoa_id: '', email: '', role: '', senha: '', confirmacao: '' };
const emailSchema = z.string().email().max(254);

export function FormularioUsuario({ onClose, onCriado }) {
    const [formulario, setFormulario] = useState(formularioInicial);
    const [erros, setErros] = useState({});
    const [erroEnvio, setErroEnvio] = useState('');
    const [enviando, setEnviando] = useState(false);
    const envioEmAndamento = useRef(false);

    function atualizarCampo(campo, valor) {
        setFormulario((atual) => ({ ...atual, [campo]: valor, ...(campo === 'modo' ? { nome: '', pessoa_id: '' } : {}) }));
        setErros((atuais) => campo === 'modo' ? {} : { ...atuais, [campo]: undefined, ...(campo === 'senha' ? { confirmacao: undefined } : {}) });
        setErroEnvio('');
    }

    function fecharModal() {
        if (!envioEmAndamento.current) onClose();
    }

    async function enviar(event) {
        event.preventDefault();
        if (envioEmAndamento.current) return;
        const form = event.currentTarget;
        const novosErros = {};
        if (formulario.modo === 'nova' && !formulario.nome.trim()) novosErros.nome = 'Informe o nome completo.';
        if (formulario.modo === 'nova' && formulario.nome.trim().length > 200) novosErros.nome = 'O nome deve ter até 200 caracteres.';
        if (formulario.modo === 'existente' && !formulario.pessoa_id) novosErros.pessoa_id = 'Busque e selecione um funcionário.';
        if (!emailSchema.safeParse(formulario.email.trim()).success) novosErros.email = 'Informe um e-mail válido de até 254 caracteres.';
        if (!['admin', 'professor'].includes(formulario.role)) novosErros.role = 'Selecione a função do usuário.';
        if (formulario.senha.length < 8 || formulario.senha.length > 256) novosErros.senha = 'A senha deve ter entre 8 e 256 caracteres.';
        if (!formulario.confirmacao || formulario.confirmacao !== formulario.senha) novosErros.confirmacao = 'A confirmação deve ser igual à senha.';

        setErros(novosErros);
        setErroEnvio('');
        const primeiroErro = Object.keys(novosErros)[0];
        if (primeiroErro) {
            const campo = form.elements.namedItem(primeiroErro);
            if (campo?.disabled) form.querySelector('#busca-funcionario')?.focus();
            else campo?.focus();
            return;
        }

        const dados = {
            modo: formulario.modo,
            email: formulario.email.trim().toLowerCase(),
            role: formulario.role,
            senha: formulario.senha,
            ...(formulario.modo === 'nova' ? { pessoa: { nome: formulario.nome.trim() } } : { pessoa_id: Number(formulario.pessoa_id) }),
        };
        envioEmAndamento.current = true;
        setEnviando(true);
        try {
            const criado = await usuariosService.criar(dados);
            onCriado(criado);
        } catch (error) {
            const camposBackend = { 'pessoa.nome': 'nome', pessoa_id: 'pessoa_id', email: 'email', role: 'role', senha: 'senha' };
            const errosCampos = {};
            for (const item of error.response?.data?.erros ?? []) {
                const campo = camposBackend[item.campo];
                if (campo) errosCampos[campo] = item.mensagem;
            }
            setErros(errosCampos);
            setErroEnvio(error.response?.data?.erro || 'Não foi possível criar o usuário. Tente novamente.');
        } finally {
            envioEmAndamento.current = false;
            setEnviando(false);
        }
    }

    function erroCampo(campo) {
        return erros[campo] && <p id={`usuario-${campo}-erro`} className="mb-md text-sm text-red-700">{erros[campo]}</p>;
    }

    function acessibilidadeCampo(campo) {
        return { 'aria-invalid': Boolean(erros[campo]), 'aria-describedby': erros[campo] ? `usuario-${campo}-erro` : undefined };
    }

    return (
        <Modal isOpen onClose={fecharModal} title="Novo usuário" subtitle="Defina os dados de acesso e o nível de permissão."
            confirmText="Criar usuário" cancelText="Cancelar" confirmFormId="form-cadastro-usuario" onConfirm={enviar} isConfirmLoading={enviando}>
            <form id="form-cadastro-usuario" onSubmit={enviar} noValidate>
                <fieldset disabled={enviando} className="min-w-0">
                    <SelecaoOpcao label="Usuário" name="modo" required value={formulario.modo} onChange={(valor) => atualizarCampo('modo', valor)}
                        optionClassName="min-w-0" className="[&>div]:flex-col sm:[&>div]:flex-row"
                        options={[{ value: 'nova', title: 'Novo usuário' }, { value: 'existente', title: 'Cadastrar usuário para funcionário existente' }]} />
                    {formulario.modo === 'nova' ? <>
                        <Input id="usuario-nome" name="nome" label="Nome completo" placeholder="Ex: Maria da Silva" maxLength={200} required
                            value={formulario.nome} onChange={(event) => atualizarCampo('nome', event.target.value)} {...acessibilidadeCampo('nome')} />
                        {erroCampo('nome')}
                    </> : <SeletorFuncionario value={formulario.pessoa_id} onChange={(valor) => atualizarCampo('pessoa_id', valor)} error={erros.pessoa_id} />}
                    <Input id="usuario-email" name="email" label="E-mail" type="email" placeholder="Ex: nome@apae.com" maxLength={254}
                        autoComplete="off" autoCapitalize="none" spellCheck={false} required value={formulario.email}
                        onChange={(event) => atualizarCampo('email', event.target.value)} {...acessibilidadeCampo('email')} />
                    {erroCampo('email')}
                    <Select id="usuario-role" name="role" label="Função" placeholder="Selecione a função" required value={formulario.role}
                        onChange={(event) => atualizarCampo('role', event.target.value)} error={erros.role}
                        options={[{ value: 'professor', label: 'Professor' }, { value: 'admin', label: 'Administrador' }]} />
                    <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
                        <div>
                            <Input id="usuario-senha" name="senha" label="Senha" type="password" placeholder="Mínimo de 8 caracteres" minLength={8} maxLength={256}
                                autoComplete="new-password" required value={formulario.senha} onChange={(event) => atualizarCampo('senha', event.target.value)} {...acessibilidadeCampo('senha')} />
                            {erroCampo('senha')}
                        </div>
                        <div>
                            <Input id="usuario-confirmacao" name="confirmacao" label="Confirmar senha" type="password" placeholder="Digite a senha novamente" maxLength={256}
                                autoComplete="new-password" required value={formulario.confirmacao} onChange={(event) => atualizarCampo('confirmacao', event.target.value)} {...acessibilidadeCampo('confirmacao')} />
                            {erroCampo('confirmacao')}
                        </div>
                    </div>
                    {erroEnvio && <p role="alert" className="mb-md rounded-sm bg-red-50 p-sm text-sm text-red-700">{erroEnvio}</p>}
                </fieldset>
            </form>
        </Modal>
    );
}
