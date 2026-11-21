import { useEffect } from 'react';

export function Toast({ id, mensagem, tipo, onClose }) {
    const sucesso = tipo === 'sucesso';
    useEffect(() => {
        const timer = setTimeout(() => onClose(id), 5000);
        return () => clearTimeout(timer);
    }, [id, onClose]);

    return <div data-testid={`toast-${id}`} role={sucesso ? 'status' : 'alert'} aria-atomic="true" className={`pointer-events-auto flex items-center gap-sm rounded-sm p-sm text-bg-surface ${sucesso ? 'bg-success' : 'bg-danger'}`}>
        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
                {sucesso ? <path d="M8.70833 0C3.89896 0 0 3.89896 0 8.70833C0 13.5177 3.89896 17.4167 8.70833 17.4167C13.5177 17.4167 17.4167 13.5177 17.4167 8.70833C17.4167 3.89896 13.5177 0 8.70833 0ZM12.483 7.23583C12.5525 7.15638 12.6054 7.06384 12.6386 6.96363C12.6718 6.86343 12.6847 6.7576 12.6764 6.65236C12.6681 6.54713 12.6388 6.44461 12.5903 6.35085C12.5418 6.25709 12.4751 6.17397 12.394 6.1064C12.3129 6.03882 12.2191 5.98814 12.1181 5.95734C12.0171 5.92654 11.911 5.91625 11.806 5.92707C11.701 5.93789 11.5992 5.9696 11.5067 6.02033C11.4141 6.07107 11.3326 6.13981 11.267 6.2225L7.86283 10.3067L6.10137 8.54446C5.95206 8.40025 5.75209 8.32045 5.54452 8.32226C5.33694 8.32406 5.13838 8.40732 4.9916 8.5541C4.84482 8.70088 4.76156 8.89944 4.75976 9.10702C4.75795 9.31459 4.83775 9.51456 4.98196 9.66387L7.35696 12.0389C7.43474 12.1166 7.52787 12.1773 7.63041 12.217C7.73295 12.2568 7.84264 12.2748 7.9525 12.2698C8.06236 12.2648 8.16998 12.2369 8.26849 12.1881C8.367 12.1392 8.45425 12.0703 8.52467 11.9858L12.483 7.23583Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" />
                    : <path d="M9 0C13.9701 0 18 4.02991 18 9C18 13.9701 13.9701 18 9 18C4.02991 18 0 13.9701 0 9C0 4.02991 4.02991 0 9 0ZM11.5703 5.52106C11.5698 5.5212 11.5695 5.52142 11.5686 5.52224L9 8.09086L6.43138 5.52224C6.43054 5.52142 6.43018 5.5212 6.4297 5.52106C6.42924 5.52092 6.42875 5.52092 6.42829 5.52106C6.42785 5.5212 6.42747 5.52142 6.42664 5.52224L5.52222 6.42664C5.52142 6.42745 5.52122 6.42785 5.52106 6.42831C5.52092 6.42877 5.52092 6.42926 5.52106 6.42972L5.52126 6.43016C5.52153 6.4306 5.52186 6.43101 5.52224 6.43136L8.09086 9L5.52224 11.5687C5.52142 11.5695 5.5212 11.5699 5.52106 11.5703C5.52092 11.5708 5.52092 11.5713 5.52106 11.5717C5.5212 11.5722 5.52142 11.5726 5.52224 11.5734L6.42664 12.4778C6.42745 12.4786 6.42785 12.4788 6.42831 12.479C6.42877 12.4791 6.42926 12.4791 6.42972 12.479C6.43016 12.4788 6.43054 12.4786 6.43136 12.4778L9 9.90912L11.5687 12.4778C11.5695 12.4786 11.5699 12.4788 11.5703 12.4789C11.5708 12.4791 11.5713 12.4791 11.5717 12.4789C11.5722 12.4788 11.5726 12.4786 11.5734 12.4778L12.4778 11.5734C12.4786 11.5726 12.4788 11.5722 12.479 11.5717C12.4791 11.5712 12.4791 11.5707 12.479 11.5703L12.4788 11.5698C12.4785 11.5694 12.4782 11.569 12.4778 11.5686L9.90912 9L12.4778 6.43138C12.4786 6.43054 12.4788 6.43018 12.4789 6.4297C12.4791 6.42924 12.4791 6.42875 12.4789 6.42829C12.4788 6.42785 12.4786 6.42747 12.4778 6.42664L11.5734 5.52222C11.5729 5.5217 11.5723 5.5213 11.5717 5.52106C11.5712 5.52092 11.5708 5.52092 11.5703 5.52106Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" />}
            </svg>
        </span>
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm font-medium">{mensagem}</p>
        <div className='h-fill shrink-0 border-l-bg-surface border-l-[1px] items-center justify-center p-sm'>
            <button type="button" data-testid={`toast-${id}-fechar`} aria-label="Fechar notificação" onClick={() => onClose(id)}
                className="flex size-6 shrink-0 items-center justify-center rounded-sm hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M6 18 18 6" /></svg>
            </button>
        </div>
    </div>;
}
