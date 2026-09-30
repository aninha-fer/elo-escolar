export function Button({ children, className = '', ...props }) {
    const baseStyles = 'inline-flex h-[40px] w-auto shrink-0 items-center justify-center gap-sm rounded-sm bg-secondary px-sm py-sm text-[14px] font-semibold text-bg-surface transition-colors hover:bg-blue-500';

    return (
        <button className={`${baseStyles} ${className}`} {...props}>
            {children}
        </button>
    );
}