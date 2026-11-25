import { useNavigate } from "react-router-dom";

export function BotaoVoltar({ to, className = '', ...props }) {
    const navigate = useNavigate();

    function voltar() {
        if (window.history.state?.idx > 0) navigate(-1);
        else navigate(to, { replace: true });
    }
    
    return (
        <button
            type="button"
            onClick={voltar}
            className={`px-sm py-sm text-sm font-medium text-tertiary font-semibold bg-bg-surface border border-tertiary rounded-md hover:bg-gray-50 transition-colors ${className}`} {...props}>
            ← Voltar
        </button>
    );
}
