import { formatarDataBR } from '../../../utils/formatters';

export function HistoricoProfissionais({ historico = [] }) {
    if (!historico.length) return null;
    return <details className="mt-md border-t border-slate-200 pt-md">
        <summary className="cursor-pointer text-sm font-semibold text-text-main">Histórico de profissionais</summary>
        <p className="mt-sm text-xs text-text-muted">A vigência é registrada por dia. O cargo exibido é o atual do profissional.</p>
        <ul className="mt-sm space-y-sm">
            {historico.map((vinculo) => {
                const vazio = vinculo.data_inicio && vinculo.data_fim && vinculo.data_fim < vinculo.data_inicio;
                return <li key={vinculo.id} className="rounded-sm bg-bg-main p-sm text-sm">
                    <p className="break-words font-semibold">{vinculo.profissional.pessoa.nome}</p>
                    <p className="mt-xs text-xs text-text-muted">{vazio ? 'Incluído e retirado no mesmo dia; sem período de atuação.'
                        : `${vinculo.data_inicio ? formatarDataBR(vinculo.data_inicio) : 'Início não registrado'} até ${vinculo.data_fim ? formatarDataBR(vinculo.data_fim) : 'o momento'}`}</p>
                </li>;
            })}
        </ul>
    </details>;
}
