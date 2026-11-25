import { Spinner } from './Spinner';

export function ConteudoBotao({ carregando, descricao = 'Processando...', children }) {
    return <span className="inline-grid place-items-center">
        <span aria-hidden={carregando || undefined}
            className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-sm ${carregando ? 'invisible' : ''}`}>
            {children}
        </span>
        {carregando && <Spinner label={descricao} className="col-start-1 row-start-1" />}
    </span>;
}
