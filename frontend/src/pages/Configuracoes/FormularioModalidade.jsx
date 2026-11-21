import { useRef, useState } from 'react';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { SaveIcon } from '../../components/icons/SaveIcon';
import { modalidadesService } from '../../services/modalidadesService';
import { useToast } from '../../contexts/ToastContext';

export function FormularioModalidade({ onSalvo }) {
    const { notificar } = useToast();
    const [nome, setNome] = useState(''), [erro, setErro] = useState('');
    const [enviando, setEnviando] = useState(false);
    const envio = useRef(false);
    async function salvar(event) {
        event.preventDefault();
        if (envio.current) return;
        if (!nome.trim() || nome.trim().length > 200) { setErro('Informe o nome da modalidade, com até 200 caracteres.'); return; }
        envio.current = true; setEnviando(true); setErro('');
        try { await modalidadesService.criar({ nome: nome.trim() }); setNome(''); notificar('Modalidade cadastrada com sucesso.', 'sucesso'); onSalvo(); }
        catch (error) {
            if (error.response?.status === 409) setErro(error.response.data.erro);
            else if (error.response?.data?.erros) setErro(error.response.data.erros[0].message);
            else notificar(error.response?.data?.erro || 'Não foi possível cadastrar a modalidade.');
        } finally { envio.current = false; setEnviando(false); }
    }
    return <form noValidate onSubmit={salvar}>
        <Input id="modalidade-nome" data-testid="modalidade-nome" label="Nome" required maxLength={200} disabled={enviando} value={nome}
            onChange={(event) => { setNome(event.target.value); setErro(''); }} aria-invalid={Boolean(erro)} aria-describedby={erro ? 'modalidade-nome-erro' : undefined} />
        {erro && <p id="modalidade-nome-erro" className="mb-md text-sm text-danger">{erro}</p>}
        <div className="flex justify-end border-t border-slate-200 pt-md">
            <Button data-testid="modalidade-salvar" type="submit" disabled={enviando} className="disabled:opacity-50"><SaveIcon />{enviando ? 'Salvando...' : 'Cadastrar modalidade'}</Button>
        </div>
    </form>;
}
