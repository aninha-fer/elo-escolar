import { useCallback, useEffect, useRef, useState } from 'react';

export function useListagemInfinita(carregar, parametros = {}, versao = 0) {
    const consulta = JSON.stringify(parametros);
    const chave = `${consulta}:${versao}`;
    const [resultado, setResultado] = useState(null);
    const [tentativa, setTentativa] = useState(0);
    const controllerAtual = useRef(null);
    const envio = useRef(null);
    const buscaAnterior = useRef('');

    useEffect(() => {
        const controller = new AbortController();
        controllerAtual.current = controller;
        const params = JSON.parse(consulta);
        const atraso = params.busca !== buscaAnterior.current ? 300 : 0;
        buscaAnterior.current = params.busca;
        const timer = setTimeout(async () => {
            setResultado((anterior) => ({ chave, carregando: true, itens: [], total: 0, contagens_status: anterior?.contagens_status }));
            try {
                const pagina = await carregar({ ...params, paginado: true }, controller.signal);
                if (!controller.signal.aborted) setResultado({ ...pagina, chave, carregando: false });
            } catch (error) {
                if (!controller.signal.aborted) setResultado((anterior) => ({ ...anterior, chave, itens: [], total: 0, carregando: false,
                    erro: error.response?.data?.erro || 'Não foi possível carregar a listagem. Tente novamente.' }));
            }
        }, atraso);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [carregar, consulta, chave, tentativa]);

    const carregarMais = useCallback(async () => {
        const controller = controllerAtual.current;
        if (!controller || controller.signal.aborted || resultado?.chave !== chave || !resultado.tem_mais || envio.current === controller) return;
        envio.current = controller;
        setResultado((atual) => ({ ...atual, carregandoMais: true, erroMais: '' }));
        try {
            const pagina = await carregar({ ...JSON.parse(consulta), paginado: true, cursor: resultado.proximo_cursor }, controller.signal);
            if (!controller.signal.aborted) setResultado((atual) => {
                const ids = new Set(atual.itens.map((item) => item.id));
                return { ...atual, ...pagina, itens: [...atual.itens, ...pagina.itens.filter((item) => !ids.has(item.id))], carregandoMais: false };
            });
        } catch (error) {
            if (!controller.signal.aborted) setResultado((atual) => ({ ...atual, carregandoMais: false,
                erroMais: error.response?.data?.erro || 'Não foi possível carregar mais registros. Tente novamente.' }));
        } finally { if (envio.current === controller) envio.current = null; }
    }, [carregar, consulta, chave, resultado]);

    const atual = resultado?.chave === chave ? resultado : null;
    return { itens: atual?.itens ?? [], total: atual?.total ?? 0, totalAtivas: atual?.total_ativas,
        contagensStatus: atual?.contagens_status ?? resultado?.contagens_status,
        carregando: !atual || atual.carregando, erro: atual?.erro, carregandoMais: Boolean(atual?.carregandoMais),
        erroMais: atual?.erroMais, temMais: Boolean(atual?.tem_mais), carregarMais,
        recarregar: () => setTentativa((valor) => valor + 1) };
}
