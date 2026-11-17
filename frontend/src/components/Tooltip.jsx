import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function Tooltip({ children, content, testId }) {
    const id = useId();
    const gatilhoRef = useRef(null);
    const tooltipRef = useRef(null);
    const [aberto, setAberto] = useState(false);
    const visivel = aberto && Boolean(content);

    useLayoutEffect(() => {
        if (!visivel) return;
        function posicionar() {
            const origem = gatilhoRef.current.getBoundingClientRect();
            const tooltip = tooltipRef.current;
            const tamanho = tooltip.getBoundingClientRect();
            const esquerda = Math.max(8, Math.min(origem.left + (origem.width - tamanho.width) / 2, window.innerWidth - tamanho.width - 8));
            const abaixo = origem.bottom + tamanho.height + 8 <= window.innerHeight - 8;
            tooltip.style.left = `${esquerda}px`;
            tooltip.style.top = `${Math.max(8, abaixo ? origem.bottom + 8 : origem.top - tamanho.height - 8)}px`;
            tooltip.style.visibility = 'visible';
        }
        function fecharComEscape(event) { if (event.key === 'Escape') setAberto(false); }
        posicionar();
        window.addEventListener('resize', posicionar);
        window.addEventListener('scroll', posicionar, true);
        document.addEventListener('keydown', fecharComEscape);
        return () => {
            window.removeEventListener('resize', posicionar);
            window.removeEventListener('scroll', posicionar, true);
            document.removeEventListener('keydown', fecharComEscape);
        };
    }, [visivel]);

    if (!content) return children;

    return <>
        <span ref={gatilhoRef} data-testid={testId ? `${testId}-gatilho` : undefined} tabIndex={0}
            aria-describedby={visivel ? id : undefined}
            onMouseEnter={() => setAberto(true)} onMouseLeave={() => setAberto(false)}
            onFocus={() => setAberto(true)} onBlur={() => setAberto(false)}
            className="inline-flex shrink-0 [&>button:disabled]:pointer-events-none">
            {children}
        </span>
        {visivel && createPortal(<span ref={tooltipRef} id={id} role="tooltip" data-testid={testId}
            style={{ visibility: 'hidden' }}
            className="pointer-events-none fixed z-[100] max-w-[calc(100vw-16px)] rounded-sm bg-text-main px-sm py-xs text-xs text-bg-surface shadow-lg">
            {content}
        </span>, document.body)}
    </>;
}
