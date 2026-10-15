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
  showFooter = true
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" 
        onClick={onClose} 
      />

      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] bg-white rounded-lg shadow-2xl z-10 overflow-clip">
        
        <div className="flex items-start justify-between p-5 border-b border-slate-100 shrink-0 bg-bg-main">
          <div>
            <h2 className="text-lg font-bold text-text-main">{title}</h2>
            {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1 bg-bg-main text-text-main rounded-sm hover:bg-bg-surface"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {children}
        </div>

        {showFooter && (
          <div className="flex items-center justify-end gap-3 p-4 bg-bg-main border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-text-main bg-bg-surface border border-slate-300 rounded-md hover:bg-bg-main"
            >
              {cancelText}
            </button>

            {onSecondaryAction && (
              <button
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