import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function BotaoAcoes({ options = [], label = 'Ações', disabled = false, className = '' }) {
    const [aberto, setAberto] = useState(false);
    const botaoRef = useRef(null);
    const menuRef = useRef(null);
    const focoInicial = useRef('primeiro');
    const id = useId();
    const indisponivel = disabled || options.length === 0;
    const visivel = aberto && !indisponivel;

    function fechar(devolverFoco = false) {
        setAberto(false);
        if (devolverFoco) botaoRef.current?.focus();
    }

    useLayoutEffect(() => {
        if (!visivel) return;
        const botao = botaoRef.current;
        const menu = menuRef.current;

        function posicionar() {
            const limite = 8;
            const intervalo = 4;
            const origem = botao.getBoundingClientRect();
            const abaixo = window.innerHeight - origem.bottom - intervalo - limite;
            const acima = origem.top - intervalo - limite;
            const abrirAcima = menu.scrollHeight > abaixo && acima > abaixo;
            menu.style.maxHeight = `${Math.max(0, abrirAcima ? acima : abaixo)}px`;
            const tamanho = menu.getBoundingClientRect();
            menu.style.left = `${Math.max(limite, Math.min(origem.right - tamanho.width, window.innerWidth - tamanho.width - limite))}px`;
            menu.style.top = `${Math.max(limite, abrirAcima ? origem.top - tamanho.height - intervalo : origem.bottom + intervalo)}px`;
        }

        posicionar();
        const itens = menu.querySelectorAll('[role="menuitem"]:not(:disabled)');
        ((focoInicial.current === 'ultimo' ? itens[itens.length - 1] : itens[0]) ?? menu).focus();
        window.addEventListener('resize', posicionar);
        window.addEventListener('scroll', posicionar, true);
        return () => {
            window.removeEventListener('resize', posicionar);
            window.removeEventListener('scroll', posicionar, true);
        };
    }, [visivel]);

    useEffect(() => {
        if (!visivel) return;
        function fecharFora(event) {
            if (!botaoRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setAberto(false);
        }
        function fecharComEscape(event) {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            setAberto(false);
            botaoRef.current?.focus();
        }
        document.addEventListener('pointerdown', fecharFora);
        document.addEventListener('focusin', fecharFora);
        document.addEventListener('keydown', fecharComEscape);
        return () => {
            document.removeEventListener('pointerdown', fecharFora);
            document.removeEventListener('focusin', fecharFora);
            document.removeEventListener('keydown', fecharComEscape);
        };
    }, [visivel]);

    function navegarMenu(event) {
        event.stopPropagation();
        if (event.key === 'Escape') {
            event.preventDefault();
            fechar(true);
            return;
        }
        if (event.key === 'Tab') {
            fechar(true);
            return;
        }
        const itens = [...menuRef.current.querySelectorAll('[role="menuitem"]:not(:disabled)')];
        if (!itens.length) return;
        const atual = itens.indexOf(document.activeElement);
        const destino = {
            ArrowDown: (atual + 1) % itens.length,
            ArrowUp: (atual - 1 + itens.length) % itens.length,
            Home: 0,
            End: itens.length - 1,
        }[event.key];
        if (destino !== undefined) {
            event.preventDefault();
            itens[destino].focus();
        }
    }

    return (
        <>
            <button ref={botaoRef} id={`${id}-botao`} type="button" title={label} aria-label={label}
                aria-haspopup="menu" aria-expanded={visivel} aria-controls={visivel ? `${id}-menu` : undefined} disabled={indisponivel}
                onClick={(event) => { event.stopPropagation(); focoInicial.current = 'primeiro'; setAberto((atual) => !atual); }}
                onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        focoInicial.current = event.key === 'ArrowUp' ? 'ultimo' : 'primeiro';
                        setAberto(true);
                    }
                }}
                className={`inline-flex size-9 cursor-pointer shrink-0 items-center justify-center rounded-sm border bg-bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${visivel ? 'border-secondary bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500 hover:border-secondary hover:text-secondary'} ${className}`}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 18 18" fill="currentColor">
                    <circle cx="3" cy="9" r="1.5" /><circle cx="9" cy="9" r="1.5" /><circle cx="15" cy="9" r="1.5" />
                </svg>
            </button>
            {visivel && createPortal(
                <div ref={menuRef} id={`${id}-menu`} role="menu" tabIndex={-1} aria-labelledby={`${id}-botao`} onKeyDown={navegarMenu}
                    onClick={(event) => event.stopPropagation()}
                    className="fixed z-50 min-w-40 max-w-[calc(100vw-16px)] overflow-y-auto rounded-sm border border-slate-200 bg-bg-surface text-left shadow-lg divide-y divide-slate-200">
                    {options.map((option) => (
                        <button key={option.id ?? option.label} type="button" role="menuitem" tabIndex={-1} disabled={option.disabled}
                            style={option.textColor ? { color: option.textColor } : undefined}
                            onClick={(event) => { event.stopPropagation(); fechar(true); option.onClick?.(event); }}
                            className="flex w-full items-center cursor-pointer gap-sm px-md py-sm text-left text-sm text-text-main transition-colors hover:bg-bg-main focus-visible:bg-bg-main focus:outline-none disabled:cursor-not-allowed disabled:opacity-50">
                            {option.icon && <span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">{option.icon}</span>}
                            <span className="min-w-0 break-words">{option.label}</span>
                        </button>
                    ))}
                </div>, document.body,
            )}
        </>
    );
}
