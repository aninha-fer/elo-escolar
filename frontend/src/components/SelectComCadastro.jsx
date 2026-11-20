import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus } from 'react-feather';

export function SelectComCadastro({ id, label, value, options = [], placeholder = 'Selecione', disabled = false,
    required = false, onChange, onCadastrar, textoCadastro, testId }) {
    const gerado = useId(), campoId = id ?? gerado;
    const [aberto, setAberto] = useState(false);
    const botao = useRef(null), menu = useRef(null);
    const selecionado = options.find((opcao) => String(opcao.value) === String(value));
    const visivel = aberto && !disabled;

    function fechar() { setAberto(false); botao.current?.focus(); }

    useLayoutEffect(() => {
        if (!visivel) return;
        function posicionar() {
            const origem = botao.current.getBoundingClientRect();
            const abaixo = innerHeight - origem.bottom - 12, acima = origem.top - 12;
            const subir = abaixo < 180 && acima > abaixo;
            Object.assign(menu.current.style, { width: `${origem.width}px`, maxHeight: `${Math.max(80, Math.min(280, subir ? acima : abaixo))}px`,
                left: `${Math.max(8, Math.min(origem.left, innerWidth - origem.width - 8))}px`,
                top: subir ? 'auto' : `${origem.bottom + 4}px`, bottom: subir ? `${innerHeight - origem.top + 4}px` : 'auto', visibility: 'visible' });
        }
        posicionar();
        (menu.current.querySelector('[aria-selected="true"]') ?? menu.current.querySelector('button'))?.focus();
        window.addEventListener('resize', posicionar); window.addEventListener('scroll', posicionar, true);
        return () => { window.removeEventListener('resize', posicionar); window.removeEventListener('scroll', posicionar, true); };
    }, [visivel]);

    useEffect(() => {
        if (!visivel) return;
        function fora(event) { if (!botao.current?.contains(event.target) && !menu.current?.contains(event.target)) setAberto(false); }
        document.addEventListener('pointerdown', fora);
        return () => document.removeEventListener('pointerdown', fora);
    }, [visivel]);

    function teclado(event) {
        if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); fechar(); }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const itens = [...menu.current.querySelectorAll('button')], indice = itens.indexOf(document.activeElement);
        const proximo = event.key === 'Home' ? 0 : event.key === 'End' ? itens.length - 1 : (indice + (event.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length;
        itens[proximo]?.focus();
    }

    return <div className="mb-md min-w-0 w-full">
        <label id={`${campoId}-label`} htmlFor={campoId} className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600">
            {label}{required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <button ref={botao} id={campoId} data-testid={testId} type="button" role="combobox" aria-haspopup="listbox"
            aria-expanded={visivel} aria-controls={visivel ? `${campoId}-opcoes` : undefined} aria-required={required} aria-labelledby={`${campoId}-label ${campoId}-valor`}
            disabled={disabled} onClick={() => setAberto((atual) => !atual)} onKeyDown={(event) => {
                if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setAberto(true); }
            }} className="flex w-full items-center justify-between gap-sm rounded-sm border border-slate-200 bg-bg-surface px-md py-sm text-left text-text-main focus:outline-none focus:ring-1 focus:ring-secondary disabled:opacity-50">
            <span id={`${campoId}-valor`} className="min-w-0 break-words">{selecionado?.label ?? placeholder}</span><ChevronDown size={16} className="shrink-0" aria-hidden="true" />
        </button>
        {visivel && createPortal(<div ref={menu} onKeyDown={teclado} style={{ position: 'fixed', zIndex: 70, visibility: 'hidden' }}
            className="overflow-y-auto rounded-sm border border-slate-200 bg-bg-surface shadow-lg" data-testid={`${testId}-menu`}>
            <div id={`${campoId}-opcoes`} role="listbox" aria-labelledby={`${campoId}-label`}>
                {options.map((opcao) => <button key={opcao.value} data-testid={testId ? `${testId}-opcao-${opcao.value}` : undefined} type="button" role="option" tabIndex={-1}
                    aria-selected={String(value) === String(opcao.value)} onClick={() => { onChange(String(opcao.value)); fechar(); }}
                    className={`flex w-full items-center justify-between gap-sm px-md py-sm text-left text-sm hover:bg-bg-main focus-visible:bg-bg-main focus:outline-none ${String(value) === String(opcao.value) ? 'bg-blue-50 text-blue-600' : 'text-text-main'}`}>
                    {opcao.label}{String(value) === String(opcao.value) && <Check size={15} aria-hidden="true" />}
                </button>)}
                {!options.length && <p className="p-md text-sm text-text-muted">Nenhum profissional cadastrado.</p>}
            </div>
            <button type="button" data-testid={`${testId}-cadastrar`} onClick={() => { fechar(); onCadastrar(); }}
                className="flex w-full items-center gap-sm border-t border-slate-200 px-md py-sm text-left text-sm text-blue-600 hover:bg-blue-50 focus-visible:bg-blue-50 focus:outline-none">
                <Plus size={16} aria-hidden="true" />{textoCadastro}
            </button>
        </div>, document.body)}
    </div>;
}
