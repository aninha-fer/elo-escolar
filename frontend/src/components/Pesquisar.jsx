export function Pesquisar() {
    return (
        <div className="relative">
            <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2"
            >
                <path d="M6.23896 10.9637C8.74484 10.9637 10.7763 8.93233 10.7763 6.42645C10.7763 3.92056 8.74484 1.88914 6.23896 1.88914C3.73308 1.88914 1.70166 3.92056 1.70166 6.42645C1.70166 8.93233 3.73308 10.9637 6.23896 10.9637Z" stroke="#1A202C" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M11.9105 12.0981L9.44336 9.63091" stroke="#1A202C" strokeWidth="1.13433" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
                type="text"
                placeholder="Pesquisar por nome..."
                className="flex justify-center border rounded-sm border-slate-200 bg-bg-surface py-sm pl-9 pr-sm text-text-main placeholder:text-placeholder focus:outline-none focus:ring-1 w-215 s:w-full"
            />
        </div>
    )
}