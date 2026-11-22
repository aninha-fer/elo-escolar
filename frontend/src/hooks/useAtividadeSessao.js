import { useEffect } from 'react';
import { conexao } from '../services/api';
import { authService } from '../services/authService';
import { monitorarAtividadeSessao } from '../services/atividadeSessaoService';

export function useAtividadeSessao(ativa, versao) {
    useEffect(() => {
        if (!ativa) return;
        const parar = monitorarAtividadeSessao({ documento: document, janela: window, conexao,
            registrarAtividade: authService.registrarAtividade });
        const remover = conexao.assinarInvalidacao(parar);
        return () => { remover(); parar(); };
    }, [ativa, versao]);
}
