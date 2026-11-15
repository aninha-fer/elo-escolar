import { formatarStatus, formatarTelefone } from '../../utils/formatters';
import { BotaoAcoes } from '../../components/BotaoAcoes';
import EditIcon from '../../components/icons/EditIcon';

const coresFuncao = {
    Professor: 'bg-blue-50 text-blue-600',
    Oficineiro: 'bg-emerald-50 text-emerald-600',
    Terapeuta: 'bg-violet-50 text-violet-600',
    Auxiliar: 'bg-amber-50 text-amber-600',
};
const coresStatus = {
    ATIVO: 'bg-emerald-50 text-emerald-600 before:bg-emerald-600',
    INATIVO: 'bg-slate-100 text-slate-400 before:bg-slate-400',
};

function obterIniciais(nome) {
    return nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toLocaleUpperCase('pt-BR');
}

export function TabelaProfissionais({ profissionais = [], onEditar, onAlterarStatus }) {
    return (
        <div className="w-full overflow-x-auto rounded-md border border-slate-200 bg-bg-surface shadow-sm">
            <table className="w-max min-w-full table-auto border-collapse text-left text-sm">
                <caption className="sr-only">Profissionais cadastrados</caption>
                <thead className="bg-bg-main text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                        <th scope="col" className="px-lg py-md">Profissional</th>
                        <th scope="col" className="px-lg py-md">Matrícula</th>
                        <th scope="col" className="px-md py-md">Função</th>
                        <th scope="col" className="px-md py-md">Telefone</th>
                        <th scope="col" className="px-md py-md">Status</th>
                        <th scope="col" className="px-lg py-md text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {profissionais.length === 0 ? (
                        <tr><td colSpan={6} className="px-lg py-10 text-center text-slate-500">Nenhum profissional encontrado.</td></tr>
                    ) : profissionais.map((profissional) => {
                        const nome = profissional.nome || 'Nome não informado';
                        const inativo = profissional.status_geral === 'INATIVO';
                        const ativo = profissional.status_geral === 'ATIVO';
                        return (
                            <tr key={profissional.id} className={inativo ? 'bg-slate-50/50 text-slate-400' : 'text-text-main'}>
                                <td className="px-lg py-md">
                                    <div className="flex items-center gap-md">
                                        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-tertiary`} aria-hidden="true">{obterIniciais(nome)}</span>
                                        <span className="font-semibold">{nome}</span>
                                    </div>
                                </td>
                                <td className={`whitespace-nowrap px-md py-md font-mono text-xs ${inativo ? 'text-slate-400' : 'text-slate-500'}`}>{profissional.pessoa_id ?? '—'}</td>
                                <td className="px-md py-md">
                                    <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${coresFuncao[profissional.funcao] ?? 'bg-slate-100 text-slate-500'} ${inativo ? 'opacity-60' : ''}`}>{profissional.funcao}</span>
                                </td>
                                <td className={`whitespace-nowrap px-md py-md font-mono text-xs ${inativo ? 'text-slate-400' : 'text-slate-500'}`}>{formatarTelefone(profissional.telefone) || '—'}</td>
                                <td className="px-md py-md">
                                    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold before:mr-2 before:size-1.5 before:rounded-full ${coresStatus[profissional.status_geral] ?? 'bg-slate-100 text-slate-500'}`}>{formatarStatus(profissional.status_geral)}</span>
                                </td>
                                <td className="px-lg py-md text-right">
                                    <BotaoAcoes testId={`profissional-${profissional.id}-acoes`} label={`Ações para ${nome}`} options={[
                                        { id: 'editar', label: 'Editar', disabled: !ativo || !onEditar, onClick: () => onEditar(profissional), icon: <EditIcon/> },
                                        { id: 'status', label: inativo ? 'Ativar profissional' : 'Inativar profissional', textColor: inativo ? '#059669' : '#DC2626',
                                            disabled: (!ativo && !inativo) || !onAlterarStatus, onClick: () => onAlterarStatus(profissional) },
                                    ]} />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
