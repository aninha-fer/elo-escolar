import { useId } from 'react';

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  confirmText,
  cancelText = "Cancelar",
  onConfirm,
  confirmFormId,
  secondaryText,
  onSecondaryAction,
  isConfirmLoading,
  isConfirmDisabled,
  showFooter = true,
  showHeader = true,
  ariaLabelledBy,
  ariaDescribedBy,
  testId,
  dismissible = true,
}) {
  const titleId = useId();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
      <div 
        data-testid={testId ? `${testId}-fundo` : undefined}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" 
        onClick={dismissible ? onClose : undefined}
      />

      <div data-testid={testId} role="dialog" aria-modal="true" aria-labelledby={ariaLabelledBy ?? (showHeader ? titleId : undefined)} aria-describedby={ariaDescribedBy}
        onKeyDown={!dismissible ? (event) => {
          if (event.key === 'Escape') event.preventDefault();
          if (event.key !== 'Tab') return;
          const campos = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
          const primeiro = campos[0], ultimo = campos.at(-1);
          if (event.shiftKey && document.activeElement === primeiro) { event.preventDefault(); ultimo?.focus(); }
          else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primeiro?.focus(); }
        } : undefined}
        className="relative flex flex-col w-full max-w-2xl max-h-[90vh] bg-white rounded-lg shadow-2xl z-10 overflow-clip">
        
        <div className={showHeader ? 'flex items-start justify-between p-5 border-b border-slate-100 shrink-0 bg-bg-main' : 'absolute right-5 top-5 z-10'}>
          {showHeader && <div>
            <h2 id={titleId} className="text-lg font-bold text-text-main">{title}</h2>
            {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
          </div>}
          {dismissible && <button
            data-testid={testId ? `${testId}-fechar` : undefined}
            type="button" 
            onClick={onClose}
            aria-label="Fechar modal"
            className={`p-1 text-text-main rounded-sm ${showHeader ? 'bg-bg-main hover:bg-bg-surface' : 'bg-bg-surface hover:bg-bg-main'}`}
          >
            ✕
          </button>}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {children}
        </div>

        {showFooter && (
          <div className="flex items-center justify-end gap-3 p-4 bg-bg-main border-t border-slate-100 shrink-0">
            {dismissible && <button
              data-testid={testId ? `${testId}-cancelar` : undefined}
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-text-main bg-bg-surface border border-slate-300 rounded-md hover:bg-bg-main"
            >
              {cancelText}
            </button>}

            {onSecondaryAction && (
              <button
                data-testid={testId ? `${testId}-acao-secundaria` : undefined}
                type="button"
                onClick={onSecondaryAction}
                disabled={isConfirmLoading}
                className="px-4 py-2 text-sm font-semibold text-text-main bg-bg-surface border border-slate-300 rounded-md hover:bg-bg-main disabled:cursor-not-allowed disabled:opacity-50"
              >
                {secondaryText}
              </button>
            )}
            
            {onConfirm && (
              <button
                data-testid={testId ? `${testId}-confirmar` : undefined}
                type={confirmFormId ? 'submit' : 'button'}
                form={confirmFormId}
                onClick={confirmFormId ? undefined : onConfirm}
                disabled={isConfirmDisabled || isConfirmLoading}
                className="px-4 py-2 text-sm font-semibold text-secondary bg-bg-surface border border-secondary rounded-md hover:bg-secondary hover:text-bg-surface disabled:opacity-50"
              >
                {isConfirmLoading ? 'Carregando...' : confirmText}
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
