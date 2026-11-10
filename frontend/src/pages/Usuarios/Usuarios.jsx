import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { usuariosService } from '../../services/usuariosService';
import { TabelaUsuarios } from './TabelaUsuarios';
import { FormularioUsuario } from './FormularioUsuario';

function normalizarTexto(valor = '') {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function Usuarios() {
    const [usuarios, setUsuarios] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');
    const [tentativa, setTentativa] = useState(0);
    const [modalAberto, setModalAberto] = useState(false);
    const [termoBusca, setTermoBusca] = useState('');
    const [aviso, setAviso] = useState('');

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

    const busca = normalizarTexto(termoBusca);
    const filtrados = usuarios.filter((usuario) => normalizarTexto(usuario.nome).includes(busca) || normalizarTexto(usuario.email).includes(busca));

    return (
        <div className="flex min-w-0 flex-col gap-lg">
            <h1 id="profissionais-titulo" className="text-xl font-bold text-text-main">Usuários</h1>
            <div className="flex w-full flex-col gap-sm sm:flex-row sm:items-stretch">
                <Input placeholder="Pesquisar por nome ou e-mail..." aria-label="Pesquisar por nome ou e-mail"
                    value={termoBusca} onChange={(event) => setTermoBusca(event.target.value)}
                    icon={
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M6.23896 10.9637C8.74484 10.9637 10.7763 8.93233 10.7763 6.42645C10.7763 3.92056 8.74484 1.88914 6.23896 1.88914C3.73308 1.88914 1.70166 3.92056 1.70166 6.42645C1.70166 8.93233 3.73308 10.9637 6.23896 10.9637Z" stroke="currentColor" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M11.9105 12.0981L9.44336 9.63091" stroke="currentColor" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    } />
                <Button type="button" className="shrink-0 disabled:cursor-not-allowed disabled:opacity-50" disabled={carregando || Boolean(erro)}
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
                    <button type="button" onClick={tentarNovamente} className="mt-sm rounded-sm border border-danger px-sm py-xs font-semibold">Tentar novamente</button>
                </div>
            ) : <TabelaUsuarios usuarios={filtrados} />}
            {modalAberto && <FormularioUsuario onClose={() => setModalAberto(false)} onCriado={usuarioCriado} />}
        </div>
    );
}
