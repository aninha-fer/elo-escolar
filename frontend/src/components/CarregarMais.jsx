import { useEffect, useRef } from 'react';
import { Button } from './Button';

export function CarregarMais({ listagem, testId }) {
    const sentinela = useRef(null);
    const { carregando, carregandoMais, temMais, erro, erroMais, carregarMais, recarregar } = listagem;
    useEffect(() => {
        if (carregando || carregandoMais || erro || erroMais || !temMais || !('IntersectionObserver' in window)) return;
        const observer = new IntersectionObserver((entradas) => {
            if (entradas.some((entrada) => entrada.isIntersecting)) carregarMais();
        }, { root: sentinela.current?.closest('[data-scroll-listagem]') ?? null, rootMargin: '0px 0px 160px 0px' });
        if (sentinela.current) observer.observe(sentinela.current);
        return () => observer.disconnect();
    }, [carregando, carregandoMais, temMais, erro, erroMais, carregarMais]);

    return <div data-testid={testId} className="flex flex-col items-center gap-sm py-sm">
        <div ref={sentinela} aria-hidden="true" className="h-px w-full" />
        {carregando && <p role="status" className="text-sm text-text-muted">Carregando registros...</p>}
        {carregandoMais && <p role="status" className="text-sm text-text-muted">Carregando mais registros...</p>}
        {(erro || erroMais) && <p role="alert" className="text-sm text-red-700">{erro || erroMais}</p>}
        {(erro || erroMais || (temMais && !carregando && !carregandoMais)) && <Button data-testid={`${testId}-carregar`} type="button"
            onClick={erro ? recarregar : carregarMais}>{erro || erroMais ? 'Tentar novamente' : 'Carregar mais'}</Button>}
    </div>;
}
