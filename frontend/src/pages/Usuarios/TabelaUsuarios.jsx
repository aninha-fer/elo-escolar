import { BotaoAcoes } from "../../components/BotaoAcoes";
import EditIcon from "../../components/icons/EditIcon";
import { KeyIcon } from "../../components/icons/KeyIcon";
import { formatarStatus } from '../../utils/formatters';

const coresStatus = {
    ATIVO: 'bg-emerald-50 text-emerald-600 before:bg-emerald-600',
    INATIVO: 'bg-slate-100 text-slate-400 before:bg-slate-400',
};

export function TabelaUsuarios({ usuarios = [], onEditar, onResetarSenha, onAlterarStatus }) {
    const perfis = {
        admin: { nome: 'Administrador', estilo: 'bg-emerald-50 text-emerald-600 before:bg-emerald-600' },
        professor: { nome: 'Professor', estilo: 'bg-slate-100 text-slate-500 before:bg-slate-400' },
    };

    function obterIniciais(nome) {
        return nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toLocaleUpperCase('pt-BR');
    }

    return (
        <div className="w-full overflow-x-auto rounded-md border border-slate-200 bg-bg-surface shadow-sm">
            <table className="w-max min-w-full table-auto border-collapse text-left">
                <caption className="sr-only">Usuários cadastrados</caption>
                <thead className="bg-bg-main text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                        <th scope="col" className="px-8 py-4">Usuário</th>
                        <th scope="col" className="px-8 py-4">E-mail</th>
                        <th scope="col" className="px-8 py-4">Função</th>
                        <th scope="col" className="px-8 py-4">Status</th>
                        <th scope="col" className="px-lg py-md text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {usuarios.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">Nenhum usuário encontrado.</td></tr>
                    ) : usuarios.map((usuario) => {
                        const nome = usuario.nome || 'Nome não informado';
                        const perfil = perfis[usuario.role];
                        const ativo = usuario.status === 'ATIVO';
                        const inativo = usuario.status === 'INATIVO';
                        return (
                            <tr key={usuario.id} className={inativo ? 'bg-slate-50/50 text-slate-400' : 'text-slate-800'}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-tertiary" aria-hidden="true">{obterIniciais(nome)}</span>
                                        <p className="font-semibold">{nome}</p>
                                    </div>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-slate-500">{usuario.email}</td>
                                <td className="whitespace-nowrap px-6 py-4">
                                    <span className={`inline-flex min-w-30 items-center rounded-full px-4 py-2 text-sm font-semibold before:mr-2 before:size-2 before:shrink-0 before:rounded-full ${perfil?.estilo ?? 'bg-slate-100 text-slate-500'}`}>
                                        {perfil?.nome ?? usuario.role}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4">
                                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold before:mr-2 before:size-1.5 before:rounded-full ${coresStatus[usuario.status] ?? 'bg-slate-100 text-slate-500 before:bg-slate-400'}`}>
                                        {formatarStatus(usuario.status)}
                                    </span>
                                </td>
                                <td className="px-lg py-md text-right">
                                    <BotaoAcoes
                                        label={`Ações para ${usuario.nome}`}
                                        options={[
                                            {
                                                id: 'editar', label: 'Editar', disabled: !ativo || !onEditar, onClick: () => onEditar(usuario), icon: <EditIcon/>
                                            },
                                            {
                                                id: 'reset', label: 'Resetar senha', disabled: !ativo || !onResetarSenha, onClick: () => onResetarSenha(usuario), icon: <KeyIcon/>
                                            },
                                            {
                                                id: 'status', label: inativo ? 'Ativar usuário' : 'Inativar usuário', textColor: inativo ? '#059669' : '#DC2626',
                                                disabled: (!ativo && !inativo) || !onAlterarStatus, onClick: () => onAlterarStatus(usuario)
                                            },
                                        ]}
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
