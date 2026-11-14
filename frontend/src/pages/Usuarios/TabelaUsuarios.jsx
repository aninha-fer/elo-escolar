import { BotaoAcoes } from "../../components/BotaoAcoes";
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
                                                id: 'editar', label: 'Editar', disabled: !ativo || !onEditar, onClick: () => onEditar(usuario), icon: <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
                                                    <path d="M21.9665 7.21068L24.7892 10.0333M23.7812 4.72401L16.1452 12.36C15.7494 12.7531 15.4802 13.2555 15.3718 13.8027L14.6665 17.3333L18.1972 16.6267C18.7438 16.5173 19.2452 16.2493 19.6398 15.8547L27.2758 8.21868C27.5053 7.98922 27.6873 7.7168 27.8115 7.417C27.9357 7.11719 27.9996 6.79586 27.9996 6.47135C27.9996 6.14684 27.9357 5.8255 27.8115 5.5257C27.6873 5.22589 27.5053 4.95348 27.2758 4.72401C27.0464 4.49455 26.774 4.31253 26.4742 4.18835C26.1743 4.06416 25.853 4.00024 25.5285 4.00024C25.204 4.00024 24.8827 4.06416 24.5829 4.18835C24.283 4.31253 24.0106 4.49455 23.7812 4.72401Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="black" />
                                                    <path d="M25.3333 20V24C25.3333 24.7072 25.0523 25.3855 24.5522 25.8856C24.0521 26.3857 23.3738 26.6666 22.6666 26.6666H7.99992C7.29267 26.6666 6.6144 26.3857 6.1143 25.8856C5.6142 25.3855 5.33325 24.7072 5.33325 24V9.33329C5.33325 8.62605 5.6142 7.94777 6.1143 7.44767C6.6144 6.94758 7.29267 6.66663 7.99992 6.66663H11.9999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="black" />
                                                </svg>
                                            },
                                            {
                                                id: 'reset', label: 'Resetar senha', disabled: !ativo || !onResetarSenha, onClick: () => onResetarSenha(usuario), icon: <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
                                                    <path d="M21 2C19.5946 1.99968 18.2087 2.32857 16.9532 2.96031C15.6978 3.59205 14.6079 4.50908 13.7707 5.63792C12.9335 6.76675 12.3723 8.07599 12.1322 9.46074C11.8921 10.8455 11.9797 12.2672 12.388 13.612L2 24V30H8L18.388 19.612C19.6259 19.9878 20.9303 20.0922 22.2122 19.9183C23.4941 19.7443 24.7235 19.2961 25.8165 18.604C26.9095 17.912 27.8405 16.9925 28.546 15.9081C29.2515 14.8237 29.7149 13.6 29.9047 12.3203C30.0945 11.0407 30.0062 9.7351 29.6458 8.49264C29.2854 7.25019 28.6613 6.10003 27.8162 5.12056C26.9711 4.14109 25.9247 3.35532 24.7485 2.81681C23.5722 2.2783 22.2937 1.9997 21 2ZM21 18C20.3115 17.9998 19.6268 17.898 18.968 17.698L17.821 17.35L16.974 18.197L13.793 21.378L12.414 20L11 21.414L12.379 22.793L10.793 24.379L9.414 23L8 24.414L9.379 25.793L7.172 28H4V24.828L13.802 15.026L14.65 14.179L14.302 13.032C13.8746 11.623 13.9023 10.1151 14.3814 8.72277C14.8604 7.33045 15.7662 6.12463 16.97 5.27683C18.1739 4.42902 19.6144 3.98242 21.0867 4.00053C22.559 4.01864 23.9881 4.50056 25.1707 5.37772C26.3533 6.25488 27.2292 7.48262 27.6738 8.8863C28.1184 10.29 28.1091 11.7981 27.6471 13.1962C27.1852 14.5942 26.2941 15.8111 25.1008 16.6735C23.9074 17.5359 22.4724 18.0001 21 18Z" fill="black" />
                                                    <path d="M22 12C23.1046 12 24 11.1046 24 10C24 8.89543 23.1046 8 22 8C20.8954 8 20 8.89543 20 10C20 11.1046 20.8954 12 22 12Z" fill="black" />
                                                </svg>
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
