import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { usuariosService } from '../../services/usuariosService';
import { TabelaUsuarios } from './TabelaUsuarios';
import { FormularioUsuario } from './FormularioUsuario';
import { EditarUsuario } from './EditarUsuario';
import { ResetarSenhaUsuario } from './ResetarSenhaUsuario';
import { ModalConfirmacao } from '../../components/ModalConfirmacao';
import { useAuth } from '../../contexts/AuthContext';

function normalizarTexto(valor = '') {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function Usuarios() {
    const { usuario: usuarioAtual, recarregarSessao } = useAuth();
    const [usuarios, setUsuarios] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');
    const [tentativa, setTentativa] = useState(0);
    const [modalAberto, setModalAberto] = useState(false);
    const [termoBusca, setTermoBusca] = useState('');
    const [aviso, setAviso] = useState('');
    const [operacao, setOperacao] = useState(null);
    const [alterandoStatus, setAlterandoStatus] = useState(false);
    const [erroStatus, setErroStatus] = useState('');
    const envioStatusEmAndamento = useRef(false);

    useEffect(() => {
        const controller = new AbortController();
        async function carregarUsuarios() {
            try {
                const dados = await usuariosService.listarTodos(controller.signal);
                if (!controller.signal.aborted) setUsuarios(dados);
            } catch (error) {
                if (controller.signal.aborted) return;
                setErro(error.response?.data?.erro || 'Não foi possível carregar os usuários.');
            } finally {
                if (!controller.signal.aborted) setCarregando(false);
            }
        }
        carregarUsuarios();
        return () => controller.abort();
    }, [tentativa]);

    function tentarNovamente() {
        setErro('');
        setCarregando(true);
        setTentativa((atual) => atual + 1);
    }

    function usuarioCriado(usuario) {
        setUsuarios((atuais) => [...atuais, usuario].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
        setModalAberto(false);
        setAviso('Usuário criado com sucesso.');
    }

    function abrirOperacao(tipo, usuario) {
        setAviso('');
        setErroStatus('');
        setOperacao({ tipo, usuario });
    }

    function usuarioAtualizado(usuario, mensagem) {
        setUsuarios((atuais) => atuais.map((atual) => atual.id === usuario.id ? usuario : atual)
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
        setOperacao(null);
        setAviso(mensagem);
        if (usuario.id === usuarioAtual.id) recarregarSessao();
    }

    function fecharConfirmacao() {
        if (!envioStatusEmAndamento.current) setOperacao(null);
    }

    async function confirmarStatus() {
        if (envioStatusEmAndamento.current || !operacao || operacao.tipo !== 'status') return;
        const ativando = operacao.usuario.status === 'INATIVO';
        envioStatusEmAndamento.current = true;
        setAlterandoStatus(true);
        setErroStatus('');
        try {
            const atualizado = await usuariosService.editar(operacao.usuario.id, { status: ativando ? 'ATIVO' : 'INATIVO' });
            usuarioAtualizado(atualizado, ativando ? 'Usuário ativado com sucesso.' : 'Usuário inativado com sucesso.');
        } catch (error) {
            setErroStatus(error.response?.data?.erro || 'Não foi possível alterar o status do usuário. Tente novamente.');
        } finally {
            envioStatusEmAndamento.current = false;
            setAlterandoStatus(false);
        }
    }

    async function confirmarExclusao() {
        if (envioStatusEmAndamento.current || operacao?.tipo !== 'excluir') return;
        envioStatusEmAndamento.current = true;
        setAlterandoStatus(true);
        setErroStatus('');
        try {
            await usuariosService.excluir(operacao.usuario.id);
            setUsuarios((atuais) => atuais.filter((usuario) => usuario.id !== operacao.usuario.id));
            setOperacao(null);
            setAviso('Usuário excluído com sucesso.');
            if (operacao.usuario.id === usuarioAtual.id) await recarregarSessao();
        } catch (error) {
            setErroStatus(error.response?.data?.erro || 'Não foi possível excluir o usuário. Tente novamente.');
        } finally {
            envioStatusEmAndamento.current = false;
            setAlterandoStatus(false);
        }
    }

    const busca = normalizarTexto(termoBusca);
    const filtrados = usuarios.filter((usuario) => normalizarTexto(usuario.nome).includes(busca) || normalizarTexto(usuario.email).includes(busca));

    return (
        <div className="flex min-w-0 flex-col gap-lg">
            <h1 id="profissionais-titulo" className="text-xl font-bold text-text-main">Usuários</h1>
            <div className="flex w-full flex-col gap-sm sm:flex-row sm:items-stretch">
                <Input data-testid="usuarios-busca" placeholder="Pesquisar por nome ou e-mail..." aria-label="Pesquisar por nome ou e-mail"
                    value={termoBusca} onChange={(event) => setTermoBusca(event.target.value)}
                    icon={
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M6.23896 10.9637C8.74484 10.9637 10.7763 8.93233 10.7763 6.42645C10.7763 3.92056 8.74484 1.88914 6.23896 1.88914C3.73308 1.88914 1.70166 3.92056 1.70166 6.42645C1.70166 8.93233 3.73308 10.9637 6.23896 10.9637Z" stroke="currentColor" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M11.9105 12.0981L9.44336 9.63091" stroke="currentColor" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    } />
                <Button data-testid="usuarios-novo" type="button" className="shrink-0 disabled:cursor-not-allowed disabled:opacity-50" disabled={carregando || Boolean(erro)}
                    onClick={() => { setModalAberto(true); }}>
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M6.99365 2.914V11.0732M2.91406 6.99361H11.0733" stroke="currentColor" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Novo Usuário
                </Button>
            </div>
            {aviso && <p role="status" className="rounded-sm bg-emerald-50 p-md text-sm text-emerald-700">{aviso}</p>}
            {carregando ? <p role="status">Carregando usuários...</p> : erro ? (
                <div className="rounded-sm bg-red-50 p-md text-sm text-red-700">
                    <p role="alert">{erro}</p>
                    <button data-testid="usuarios-tentar-novamente" type="button" onClick={tentarNovamente} className="mt-sm rounded-sm border border-danger px-sm py-xs font-semibold">Tentar novamente</button>
                </div>
            ) : <TabelaUsuarios usuarios={filtrados}
                onEditar={(usuario) => abrirOperacao('editar', usuario)}
                onResetarSenha={(usuario) => abrirOperacao('senha', usuario)}
                onAlterarStatus={(usuario) => abrirOperacao('status', usuario)}
                onExcluir={(usuario) => abrirOperacao('excluir', usuario)} />}
            {modalAberto && <FormularioUsuario onClose={() => setModalAberto(false)} onCriado={usuarioCriado} />}
            {operacao?.tipo === 'editar' && <EditarUsuario key={operacao.usuario.id} usuario={operacao.usuario}
                onClose={() => setOperacao(null)} onSalvo={(usuario) => usuarioAtualizado(usuario, 'Usuário atualizado com sucesso.')} />}
            {operacao?.tipo === 'senha' && <ResetarSenhaUsuario key={operacao.usuario.id} usuario={operacao.usuario}
                onClose={() => setOperacao(null)} onSalvo={(usuario) => usuarioAtualizado(usuario, 'Senha redefinida com sucesso.')} />}
            {operacao?.tipo === 'status' && <ModalConfirmacao testId="usuario-alterar-status" isOpen onClose={fecharConfirmacao}
                estado={operacao.usuario.status === 'INATIVO' ? 'confirmacao' : 'atencao'} showCancel
                title={operacao.usuario.status === 'INATIVO' ? 'Ativar usuário?' : 'Inativar usuário?'}
                description={<>
                    {operacao.usuario.status === 'INATIVO'
                        ? <>Deseja ativar o usuário <strong>{operacao.usuario.nome}</strong>?</>
                        : <>Deseja inativar o usuário <strong>{operacao.usuario.nome}</strong>? Ele perderá o acesso ao sistema.</>}
                    {erroStatus && <span role="alert" className="mt-md block text-sm text-red-700">{erroStatus}</span>}
                </>}
                confirmText={operacao.usuario.status === 'INATIVO' ? 'Confirmar ativação' : 'Confirmar inativação'}
                onConfirm={confirmarStatus} isConfirmLoading={alterandoStatus} />}
            {operacao?.tipo === 'excluir' && <ModalConfirmacao testId="usuario-excluir" isOpen onClose={fecharConfirmacao}
                estado="atencao" showCancel title="Excluir usuário?"
                description={<>
                    Deseja excluir o usuário <strong>{operacao.usuario.nome}</strong>? Essa ação não pode ser desfeita.
                    {erroStatus && <span role="alert" className="mt-md block text-sm text-red-700">{erroStatus}</span>}
                </>}
                confirmText="Confirmar exclusão" onConfirm={confirmarExclusao} isConfirmLoading={alterandoStatus} />}
        </div>
    );
}
