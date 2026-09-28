import { formatarMensagemConflito } from "../../../utils/formatters";

export function ConflitosOficinas({ conflitos = [] }) {
    return (
        <section className="rounded-md border-2 border-red-200 bg-red-50 p-lg my-lg" role="alert">
            <div className="flex items-center gap-sm text-red-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.7 3.86a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <h2 className="font-bold">Conflitos detectados - inscrição bloqueada</h2>
            </div>

            <ul className="mt-md space-y-sm">
                {conflitos.map((conflito, indice) => (
                    <li
                        key={`${conflito}-${indice}`}
                        className="flex items-start gap-sm rounded-md border-2 border-red-200 bg-bg-surface px-md py-sm text-sm text-red-600"
                    >
                        <span aria-hidden="true">⚠</span>
                        <span>{formatarMensagemConflito(conflito)}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
