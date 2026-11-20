import apaeLogo from '../../assets/apae.png';

export function IndicadorConexao({ parado = false }) {
    return <div className={`conexao-indicador ${parado ? 'conexao-indicador-parado' : ''}`} aria-hidden="true">
        <div className="conexao-orbita conexao-orbita-externa"><span /></div>
        <div className="conexao-orbita conexao-orbita-interna"><span /></div>
        <div className="conexao-logo"><img src={apaeLogo} alt="" /></div>
    </div>;
}
