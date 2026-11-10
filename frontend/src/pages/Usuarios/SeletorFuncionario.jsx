import { useEffect, useState } from 'react';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { usuariosService } from '../../services/usuariosService';

export function SeletorFuncionario({ value, onChange, error }) {
    const [busca, setBusca] = useState('');
    const [resultado, setResultado] = useState(null);
    const [tentativa, setTentativa] = useState(0);
    const termo = busca.trim();
    const buscaValida = termo.length >= 2 && termo.length <= 100;
    const carregando = buscaValida && (!resultado || resultado.termo !== termo || resultado.status === 'carregando');
    const pessoas = resultado?.termo === termo ? resultado.pessoas : [];

    useEffect(() => {
        if (!buscaValida) return;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setResultado({ termo, status: 'carregando', pessoas: [] });
            try {
                const pessoas = await usuariosService.buscarFuncionariosElegiveis(termo, controller.signal);
                if (!controller.signal.aborted) setResultado({ termo, status: 'sucesso', pessoas });
            } catch (error) {
                if (!controller.signal.aborted) setResultado({ termo, status: 'erro', pessoas: [], erro: error.response?.data?.erro || 'Não foi possível buscar os funcionários.' });
            }
        }, 300);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [termo, buscaValida, tentativa]);

    function alterarBusca(event) {
        const valor = event.target.value;
        setBusca(valor);
        if (valor.trim() !== termo) {
            setResultado(null);
            onChange('');
        }
    }

    return (
        <div>
            <Input id="busca-funcionario" label="Buscar funcionário por nome" placeholder="Digite pelo menos 2 caracteres"
                value={busca} onChange={alterarBusca} maxLength={100} aria-describedby="busca-funcionario-status" />
            <div id="busca-funcionario-status" className="mb-md text-sm text-text-muted" role="status">
                {!buscaValida ? 'Digite pelo menos 2 caracteres para buscar funcionários ativos sem usuário.' : carregando ? 'Buscando funcionários...' : resultado?.status === 'sucesso' && pessoas.length === 0 ? 'Nenhum funcionário disponível encontrado.' : resultado?.status === 'sucesso' ? 'Selecione um dos funcionários encontrados. Refine o nome se necessário.' : ''}
            </div>
            {resultado?.status === 'erro' && (
                <div className="mb-md rounded-sm bg-red-50 p-sm text-sm text-red-700">
                    <p role="alert">{resultado.erro}</p>
                    <button type="button" className="mt-sm rounded-sm border border-danger px-sm py-xs font-semibold" onClick={() => { setResultado(null); setTentativa((atual) => atual + 1); }}>Tentar novamente</button>
                </div>
            )}
            <Select id="usuario-pessoa" name="pessoa_id" label="Funcionário" placeholder="Selecione o funcionário"
                required value={value} onChange={(event) => onChange(event.target.value)} error={error}
                disabled={carregando || pessoas.length === 0}
                options={pessoas.map((pessoa) => ({ value: pessoa.id, label: `${pessoa.nome} · ID ${pessoa.id}` }))} />
        </div>
    );
}
