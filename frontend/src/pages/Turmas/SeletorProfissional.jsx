import { ConteudoBotao } from '../../components/ConteudoBotao';
import { Spinner } from '../../components/Spinner';
import { useState } from 'react';
import { Input } from '../../components/Input';

function normalizarTexto(valor) {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function SeletorProfissional({ profissionais, value = [], onChange, carregando, erroCarga, onTentarNovamente, error }) {
    const [busca, setBusca] = useState('');
    const filtrados = profissionais.filter((profissional) => normalizarTexto(profissional.nome).includes(normalizarTexto(busca)));

    return (
        <fieldset className="mb-md min-w-0" aria-describedby={error ? 'turma-profissional-erro' : undefined}>
            <legend className="mb-sm font-mono text-xs font-semibold uppercase tracking-wider text-slate-600">
                Professores e auxiliares <span className="text-danger">*</span>
            </legend>
            <p className="mb-sm text-xs text-text-muted">Selecione um ou mais profissionais responsáveis. {value.length} selecionado(s).</p>
            <div className="overflow-hidden rounded-sm border border-slate-200">
                <Input data-testid="turma-formulario-busca-profissional" id="turma-busca-profissional" aria-label="Buscar profissional" placeholder="Buscar profissional..."
                    wrapperClassName="mb-0!" inputClassName="rounded-none! border-0! bg-bg-main!"
                    value={busca} onChange={(event) => setBusca(event.target.value)}
                    icon={<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>} />
                {erroCarga ? <div className="p-md text-sm text-red-700">
                        <p role="alert">{erroCarga}</p>
                        <button data-testid="turma-formulario-profissionais-tentar-novamente" type="button" className="mt-sm underline" disabled={carregando} onClick={onTentarNovamente}><ConteudoBotao carregando={carregando}>Tentar novamente</ConteudoBotao></button>
                    </div> : carregando ? <div className="p-md text-sm text-text-muted flex items-center gap-sm"><Spinner label="Carregando profissionais..." /><span>Carregando profissionais...</span></div> : filtrados.length === 0 ? <p role="status" className="p-md text-sm text-text-muted">
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
                                    {profissional.indisponivel && <span className="block text-xs text-amber-800">Indisponível para novos vínculos</span>}
                                </span>
                                <input data-testid={`turma-formulario-profissional-${profissional.id}`} type="checkbox" name="profissionais_ids" value={profissional.id} checked={value.includes(profissional.id)}
                                    disabled={profissional.indisponivel && !value.includes(profissional.id)}
                                    onChange={() => onChange(value.includes(profissional.id) ? value.filter((id) => id !== profissional.id) : [...value, profissional.id].sort((a, b) => a - b))} aria-invalid={Boolean(error)}
                                    aria-describedby={error ? 'turma-profissional-erro' : undefined} className="size-4 shrink-0 accent-blue-600" />
                            </label>
                        ))}
                    </div>}
            </div>
            {error && <p id="turma-profissional-erro" className="mt-sm text-sm text-red-700">{error}</p>}
        </fieldset>
    );
}
