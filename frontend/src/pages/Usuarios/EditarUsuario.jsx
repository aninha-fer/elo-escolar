import { useRef, useState } from 'react';
import { z } from 'zod';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { usuariosService } from '../../services/usuariosService';

const emailSchema = z.string().email().max(254);

export function EditarUsuario({ usuario, onClose, onSalvo }) {
    const [formulario, setFormulario] = useState({ nome: usuario.nome, email: usuario.email, role: usuario.role });
    const [erros, setErros] = useState({});
    const [erroEnvio, setErroEnvio] = useState('');
    const [enviando, setEnviando] = useState(false);
    const envioEmAndamento = useRef(false);
    const dados = {
        ...(formulario.nome.trim() !== usuario.nome ? { pessoa: { nome: formulario.nome.trim() } } : {}),
        ...(formulario.email.trim().toLowerCase() !== usuario.email ? { email: formulario.email.trim().toLowerCase() } : {}),
        ...(formulario.role !== usuario.role ? { role: formulario.role } : {}),
    };

    function fecharModal() {
        if (!envioEmAndamento.current) onClose();
    }

    function atualizarCampo(campo, valor) {
        setFormulario((atual) => ({ ...atual, [campo]: valor }));
        setErros((atuais) => ({ ...atuais, [campo]: undefined }));
        setErroEnvio('');
    }

    async function enviar(event) {
        event.preventDefault();
        if (envioEmAndamento.current) return;
        const novosErros = {};
        if (!formulario.nome.trim() || formulario.nome.trim().length > 200) novosErros.nome = 'Informe o nome completo, com até 200 caracteres.';
        if (!emailSchema.safeParse(formulario.email.trim()).success) novosErros.email = 'Informe um e-mail válido de até 254 caracteres.';
        if (!['admin', 'professor'].includes(formulario.role)) novosErros.role = 'Selecione a função do usuário.';
        setErros(novosErros);
        setErroEnvio('');
        const primeiroErro = Object.keys(novosErros)[0];
        if (primeiroErro) {
            event.currentTarget.elements.namedItem(primeiroErro)?.focus();
            return;
        }
        if (!Object.keys(dados).length) return;
        envioEmAndamento.current = true;
        setEnviando(true);
        try {
            const atualizado = await usuariosService.editar(usuario.id, dados);
            onSalvo(atualizado);
        } catch (error) {
            const campos = { 'pessoa.nome': 'nome', email: 'email', role: 'role' };
            const errosCampos = {};
            for (const item of error.response?.data?.erros ?? []) {
                if (campos[item.campo]) errosCampos[campos[item.campo]] = item.mensagem;
            }
            setErros(errosCampos);
            setErroEnvio(error.response?.data?.erro || 'Não foi possível salvar as alterações. Tente novamente.');
        } finally {
            envioEmAndamento.current = false;
            setEnviando(false);
        }
    }

    function acessibilidadeCampo(campo) {
        return { 'aria-invalid': Boolean(erros[campo]), 'aria-describedby': erros[campo] ? `editar-usuario-${campo}-erro` : undefined };
    }

    function erroCampo(campo) {
        return erros[campo] && <p id={`editar-usuario-${campo}-erro`} className="mb-md text-sm text-red-700">{erros[campo]}</p>;
    }

    return (
        <Modal isOpen onClose={fecharModal} title="Editar usuário" subtitle="Defina os dados de acesso e o nível de permissão."
            confirmText="Salvar alterações" confirmFormId="form-editar-usuario" onConfirm={enviar}
            isConfirmLoading={enviando} isConfirmDisabled={!Object.keys(dados).length}>
            <form id="form-editar-usuario" onSubmit={enviar} noValidate>
                <fieldset disabled={enviando} className="min-w-0">
                    <Input id="editar-usuario-nome" name="nome" label="Nome completo" labelClassName="font-mono" required maxLength={200}
                        value={formulario.nome} onChange={(event) => atualizarCampo('nome', event.target.value)} {...acessibilidadeCampo('nome')} />
                    {erroCampo('nome')}
                    <Input id="editar-usuario-email" name="email" label="E-mail" labelClassName="font-mono" type="email" required maxLength={254}
                        value={formulario.email} onChange={(event) => atualizarCampo('email', event.target.value)} {...acessibilidadeCampo('email')} />
                    {erroCampo('email')}
                    <Select id="editar-usuario-role" name="role" label="Função" labelClassName="font-mono" required value={formulario.role}
                        onChange={(event) => atualizarCampo('role', event.target.value)} error={erros.role}
                        options={[{ value: 'admin', label: 'Administrador' }, { value: 'professor', label: 'Professor' }]} />
                    {erroEnvio && <p role="alert" className="rounded-sm bg-red-50 p-sm text-sm text-red-700">{erroEnvio}</p>}
                </fieldset>
            </form>
        </Modal>
    );
}
