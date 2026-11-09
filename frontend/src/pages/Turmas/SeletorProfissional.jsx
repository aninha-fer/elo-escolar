import { useState } from 'react';
import { Input } from '../../components/Input';

function normalizarTexto(valor) {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function SeletorProfissional({ profissionais, value, onChange, tipo, carregando, erroCarga, onTentarNovamente, error }) {
    const [busca, setBusca] = useState('');
    const filtrados = profissionais.filter((profissional) => normalizarTexto(profissional.nome).includes(normalizarTexto(busca)));

    return (
        <fieldset className="mb-md min-w-0" aria-describedby={error ? 'turma-profissional-erro' : undefined}>
            <legend className="mb-sm font-mono text-xs font-semibold uppercase tracking-wider text-slate-600">
                {tipo === 'REGULAR' ? 'Professores e auxiliares' : 'Professores e oficineiros'} <span className="text-danger">*</span>
            </legend>
            <p className="mb-sm text-xs text-text-muted">Selecione um profissional responsável.</p>
            <div className="overflow-hidden rounded-sm border border-slate-200">
                <Input id="turma-busca-profissional" aria-label="Buscar profissional" placeholder="Buscar profissional..."
                    wrapperClassName="mb-0!" inputClassName="rounded-none! border-0! bg-bg-main!"
                    value={busca} onChange={(event) => setBusca(event.target.value)}
                    icon={<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>} />
                {carregando ? <p role="status" className="p-md text-sm text-text-muted">Carregando profissionais...</p>
                    : erroCarga ? <div className="p-md text-sm text-red-700">
                        <p role="alert">{erroCarga}</p>
                        <button type="button" className="mt-sm underline" onClick={onTentarNovamente}>Tentar novamente</button>
                    </div> : filtrados.length === 0 ? <p role="status" className="p-md text-sm text-text-muted">
                        {profissionais.length === 0 ? 'Nenhum profissional com função compatível cadastrado.' : 'Nenhum profissional encontrado para esta busca.'}
                    </p> : <div className="max-h-60 overflow-y-auto divide-y divide-slate-200">
                        {filtrados.map((profissional) => (
                            <label key={profissional.id} className="flex cursor-pointer items-center gap-sm p-md hover:bg-bg-main has-checked:bg-blue-50">
                                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                                    {profissional.nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toLocaleUpperCase('pt-BR')}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block break-words text-sm font-semibold text-text-main">{profissional.nome}</span>
                                    <span className="block text-xs text-text-muted">{profissional.funcao}</span>
                                </span>
                                <input type="radio" name="profissional_id" value={profissional.id} checked={String(value) === String(profissional.id)}
                                    onChange={(event) => onChange(event.target.value)} required aria-invalid={Boolean(error)}
                                    aria-describedby={error ? 'turma-profissional-erro' : undefined} className="size-4 shrink-0 accent-blue-600" />
                            </label>
                        ))}
                    </div>}
            </div>
            {error && <p id="turma-profissional-erro" className="mt-sm text-sm text-red-700">{error}</p>}
        </fieldset>
    );
}
