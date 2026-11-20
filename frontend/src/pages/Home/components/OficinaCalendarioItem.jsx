import { Link } from 'react-router-dom';
import { CORES_OFICINAS } from '../../../utils/calendarioOficinas';

export function OficinaCalendarioItem({ oficina }) {
    return (
        <Link data-testid={`inicio-oficina-${oficina.chave}`} to={`/turmas/${oficina.id}`} className={`flex w-34 flex-col justify-center rounded-md border p-sm transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${CORES_OFICINAS[oficina.cor].classe}`}>
            <h3 className="break-words text-sm font-bold leading-snug text-text-main">{oficina.nome}</h3>
            <p className="mt-xs break-words font-mono text-[10px] leading-relaxed">{oficina.inicio} às {oficina.fim}</p>
            <p className="mt-xs break-words font-mono text-[10px] leading-relaxed">{oficina.sala}</p>
        </Link>
    );
}
