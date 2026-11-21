import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ToastContext } from './ToastContext';
import { Toast } from '../components/Toast';

export function ToastProvider({ children }) {
    const [notificacoes, setNotificacoes] = useState([]);
    const sequencia = useRef(0);
    const fechar = useCallback((id) => setNotificacoes((atuais) => atuais.filter((item) => item.id !== id)), []);
    const notificar = useCallback((mensagem, tipo = 'erro') => {
        if (!mensagem) return;
        const id = ++sequencia.current;
        setNotificacoes((atuais) => [...atuais, { id, mensagem, tipo }]);
    }, []);
    const contexto = useMemo(() => ({ notificar }), [notificar]);

    return <ToastContext.Provider value={contexto}>
        {children}
        {createPortal(<div aria-label="Notificações" className="pointer-events-none fixed right-md top-md z-[110] flex max-h-[calc(100dvh-32px)] w-[340px] max-w-[calc(100%-32px)] flex-col gap-sm overflow-y-auto">
            {notificacoes.map((item) => <Toast key={item.id} {...item} onClose={fechar} />)}
        </div>, document.body)}
    </ToastContext.Provider>;
}
