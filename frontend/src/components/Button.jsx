export function Button({ children, ...props }) {
    const baseStyles = 'px-sm py-sm rounded-md font-[10px] flex items-center gap-sm justify-center font-semibold bg-secondary text-bg-surface hover:bg-blue-500';

    return (
        <button className={`${baseStyles}`} {...props}>
            {children}
        </button>
    );
}