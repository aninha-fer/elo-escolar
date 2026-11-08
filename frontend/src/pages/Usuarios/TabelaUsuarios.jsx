import { useNavigate } from 'react-router-dom';
import { formatarStatus } from '../../utils/formatters';

export function TabelaUsuarios({ usuarios = [], onAcao }) {
    const navigate = useNavigate();

    const estilosStatus = {
        ATIVO: 'bg-emerald-50 text-emerald-600 before:bg-emerald-600',
        INATIVO: 'bg-slate-100 text-slate-500 before:bg-slate-400',
    };

    const estilosRoles = {
        ADM: 'bg-emerald-50 text-emerald-600 before:bg-emerald-600',
        PROF: 'bg-slate-100 text-slate-500 before:bg-slate-400',
    };

    function obterIniciais(nome) {
        return nome
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((parte) => parte[0])
            .join('')
            .toLocaleUpperCase('pt-BR');
    }

    return (
        <div className="w-full overflow-x-auto rounded-md border border-slate-200 bg-bg-surface shadow-sm">
            <table className="w-max min-w-full table-auto border-collapse text-left">
                <thead className="bg-bg-main text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                        <th scope="col" className="px-8 py-4">Usuário</th>
                        <th scope="col" className="px-8 py-4">Email</th>
                        <th scope="col" className="px-8 py-4">Função</th>
                        <th scope="col" className="px-6 py-4">Status</th>
                        <th scope="col" className="px-6 py-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {usuarios.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                                Nenhum usuário encontrado.
                            </td>
                        </tr>
                    ) : usuarios.map((usuario, index) => {
                        const nome = usuario.pessoa?.nome ?? usuario.nome ?? 'Nome não informado';
                        const status = usuario.status ?? 'NÃO INFORMADO';

                        return (
                            <tr
                                key={usuario.id ?? `${nome}-${index}`}
                                tabIndex={usuario.id == null ? undefined : 0}
                                className={`transition-colors ${status === 'INATIVO' ? 'text-slate-400' : 'text-slate-800'}`}
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold bg-amber-100 text-tertiary`} aria-hidden="true">
                                            {obterIniciais(nome)}
                                        </span>
                                        <div className="flex items-center gap-xs">
                                            <p className="font-semibold">{nome}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-slate-500">{email}</td>
                                <td className="whitespace-nowrap px-6 py-4">
                                    <span className={`inline-flex min-w-30 items-center rounded-full px-4 py-2 text-sm font-semibold before:mr-2 before:size-2 before:shrink-0 before:rounded-full ${estilosRoles[role]}`}>
                                        {role}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4">
                                    <span className={`inline-flex min-w-30 items-center rounded-full px-4 py-2 text-sm font-semibold before:mr-2 before:size-2 before:shrink-0 before:rounded-full ${estilosStatus[status] ?? estilosStatus.INATIVO}`}>
                                        {formatarStatus(status)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        type="button"
                                        aria-label={`Ações para ${nome}`}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onAcao?.(aluno);
                                        }}
                                        onKeyDown={(event) => event.stopPropagation()}
                                        className="inline-flex size-11 items-center justify-center rounded-lg border-2 border-slate-200 text-slate-500 transition-colors hover:bg-bg-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                                    >
                                        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                                            <circle cx="3" cy="9" r="1.5" />
                                            <circle cx="9" cy="9" r="1.5" />
                                            <circle cx="15" cy="9" r="1.5" />
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
