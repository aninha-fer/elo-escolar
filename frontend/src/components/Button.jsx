export function Button({ children, variant, ...props }) {
    const baseStyles = 'px-4 py-2 rounded-lg font-medium transition-colors';
  
    const variants = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
        outline: 'border border-gray-400 text-gray-700 hover:bg-gray-50',
    }; 

    return (
        <button className={`${baseStyles} ${variants[variant]}`} {...props}>
            {children}
        </button>
    );
}