import { useEffect, useRef } from 'react';
import { Button } from '../Button';
import { LoginBrandPanel } from '../../pages/Login/components/LoginBrandPanel';
import { IndicadorConexao } from './IndicadorConexao';
import '../../pages/Login/login.css';
import './conexao.css';

export function TelaConexao({ estado, inicial, onTentarNovamente, focoAnterior }) {
    const painel = useRef(null);
    const falha = estado.fase === 'falha';
    const acessoNegado = estado.statusHttp === 403;
    const limite = estado.statusHttp === 429;
    useEffect(() => {
        painel.current?.focus();
        const alvo = focoAnterior.current;
        return () => { queueMicrotask(() => { if (alvo?.isConnected) alvo.focus(); }); };
    }, [focoAnterior]);

    return <div data-testid="conexao-sobreposicao" className={`conexao-tela ${inicial ? 'conexao-inicial' : ''}`}
        role="dialog" aria-modal="true" aria-labelledby="conexao-titulo" aria-describedby="conexao-descricao" tabIndex={-1} ref={painel}
        onKeyDown={(event) => {
            if (event.key === 'Escape') event.preventDefault();
            if (event.key === 'Tab') {
                event.preventDefault();
                (painel.current?.querySelector('button') ?? painel.current)?.focus();
            }
        }}>
        {inicial && <LoginBrandPanel />}
        <section className="conexao-conteudo">
            <IndicadorConexao parado={falha} />
            <p className="conexao-etiqueta">{acessoNegado ? 'ACESSO NEGADO' : limite ? 'LIMITE DE TENTATIVAS' : falha ? 'CONEXÃO INTERROMPIDA' : 'CONECTANDO'}</p>
            <div role="status" aria-live="polite">
                <h1 id="conexao-titulo">{acessoNegado ? 'Acesso não permitido' : limite ? 'Aguarde para tentar novamente' : falha ? 'Não foi possível conectar' : inicial ? 'Validando seu acesso...' : 'Restabelecendo a conexão...'}</h1>
                <p id="conexao-descricao">{falha ? estado.erro : 'Estamos tentando estabelecer conexão com o sistema.'}</p>
            </div>
            {falha ? <Button data-testid="conexao-tentar-novamente" type="button" onClick={onTentarNovamente}>Tentar novamente</Button>
                : <div className="conexao-barra" aria-hidden="true"><span /></div>}
            <p className="conexao-observacao">Após períodos de inatividade, retomar as atividades pode levar alguns segundos a mais.</p>
        </section>
    </div>;
}
