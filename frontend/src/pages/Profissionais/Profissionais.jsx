import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { profissionaisService } from '../../services/profissionaisService';
import { TabelaProfissionais } from './TabelaProfissionais';
import { FormularioProfissional } from './FormularioProfissional';

function normalizarTexto(valor) {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function Profissionais() {
    const [profissionais, setProfissionais] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');
    const [tentativa, setTentativa] = useState(0);
    const [busca, setBusca] = useState('');
    const [modalAberto, setModalAberto] = useState(false);
    const [aviso, setAviso] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        async function carregarProfissionais() {
            try {
                const dados = await profissionaisService.listarTodos(controller.signal);
                if (!controller.signal.aborted) setProfissionais(dados);
            } catch (error) {
                if (controller.signal.aborted) return;
                setErro(error.response?.data?.erro || 'Não foi possível carregar os profissionais.');
            } finally {
                if (!controller.signal.aborted) setCarregando(false);
            }
        }
        carregarProfissionais();
        return () => controller.abort();
    }, [tentativa]);

    function tentarNovamente() {
        setErro('');
        setCarregando(true);
        setTentativa((atual) => atual + 1);
    }

    function profissionalCriado(profissional) {
        setProfissionais((atuais) => [...atuais, profissional].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
        setModalAberto(false);
        setAviso('Profissional cadastrado com sucesso.');
    }

    const termo = normalizarTexto(busca);
    const filtrados = profissionais.filter((profissional) => normalizarTexto(profissional.nome).includes(termo));

    return (
        <section className="profissionais-page flex min-w-0 flex-col gap-lg" aria-labelledby="profissionais-titulo">
            <h1 id="profissionais-titulo" className="text-xl font-bold text-text-main">Profissionais</h1>
            <div className="flex flex-col gap-sm sm:flex-row sm:items-start">
                <Input id="busca-profissional" placeholder="Buscar por nome..." aria-label="Buscar profissional por nome"
                    wrapperClassName="mb-0! min-w-0" inputClassName="h-11" value={busca} onChange={(event) => setBusca(event.target.value)}
                    icon={
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                            <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" />
                        </svg>
                    } />
                <Button type="button" className="novo-profissional disabled:cursor-not-allowed disabled:opacity-50" disabled={carregando || Boolean(erro)}
                    onClick={() => { setAviso(''); setModalAberto(true); }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
                    Novo Profissional
                </Button>
            </div>
            {aviso && <p role="status" className="rounded-sm bg-emerald-50 p-md text-sm text-emerald-700">{aviso}</p>}
            {carregando ? <p role="status">Carregando profissionais...</p> : erro ? (
                <div className="rounded-sm bg-red-50 p-md text-sm text-red-700">
                    <p role="alert">{erro}</p>
                    <button type="button" className="mt-sm rounded-sm border border-danger px-sm py-xs font-semibold" onClick={tentarNovamente}>Tentar novamente</button>
                </div>
            ) : <TabelaProfissionais profissionais={filtrados} />}
            {modalAberto && <FormularioProfissional onClose={() => setModalAberto(false)} onCriado={profissionalCriado} />}
        </section>
    );
}
