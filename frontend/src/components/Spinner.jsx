export function Spinner({ label = 'Carregando...', className = '', size = 16 }) {
    return <span role="status" aria-label={label} className={`spinner ${className}`} style={{ width: size, height: size }}>
        <span aria-hidden="true" className="spinner-ponto" />
        <span aria-hidden="true" className="spinner-ponto" />
        <span aria-hidden="true" className="spinner-ponto" />
        <span aria-hidden="true" className="spinner-ponto" />
    </span>;
}
