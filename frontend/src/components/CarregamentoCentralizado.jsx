import { Spinner } from './Spinner';

export function CarregamentoCentralizado({ label = 'Carregando...' }) {
    return <div className="flex min-h-64 flex-1 items-center justify-center text-text-main">
        <Spinner label={label} size={32} />
    </div>;
}
