import { useId } from 'react';
import { Modal } from './Modal';

export function ModalConfirmacao({
    isOpen,
    onClose,
    estado = 'atencao',
    title,
    description,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    onConfirm,
    showCancel = estado === 'atencao',
    isConfirmLoading = false,
    isConfirmDisabled = false,
}) {
    const titleId = useId();
    const descriptionId = useId();
    const confirmacao = estado === 'confirmacao';

    return (
        <Modal isOpen={isOpen} onClose={onClose} showHeader={false} showFooter={false}
            ariaLabelledBy={titleId} ariaDescribedBy={description ? descriptionId : undefined}>
            <div className="p-sm text-center justify-center">
                <div aria-hidden="true" className={`mx-auto mb-md flex size-16 items-center justify-center rounded-full ${confirmacao ? 'bg-emerald-50 text-success' : 'bg-red-50 text-text-main'}`}>
                    {confirmacao ? (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m5 12 4 4L19 6" />
                        </svg>
                    ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.3 3.86 1.82 18A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />
                            <path d="M12 9v4M12 17h.01" />
                        </svg>
                    )}
                </div>
                <h2 id={titleId} className="break-words text-xl font-bold text-text-main">{title}</h2>
                {description && <p id={descriptionId} className="mt-lg whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-500 sm:text-base">{description}</p>}
                <div className="mt-lg flex flex-col items-stretch justify-center gap-md sm:flex-row sm:items-center">
                    {showCancel && <button type="button" onClick={onClose} disabled={isConfirmLoading}
                        className="rounded-md border border-slate-300 bg-bg-surface px-lg py-md text-sm font-semibold text-text-main hover:bg-bg-main disabled:cursor-not-allowed disabled:opacity-50">
                        {cancelText}
                    </button>}
                    <button type="button" onClick={onConfirm ?? onClose} disabled={isConfirmDisabled || isConfirmLoading} aria-busy={isConfirmLoading}
                        className={`inline-flex items-center justify-center gap-sm rounded-md px-lg py-md text-sm font-semibold text-bg-surface transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${confirmacao ? 'bg-success hover:bg-emerald-700' : 'bg-danger hover:bg-red-700'}`}>
                        {!confirmacao && <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M6 18 18 6" /></svg>}
                        {isConfirmLoading ? 'Carregando...' : confirmText}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
