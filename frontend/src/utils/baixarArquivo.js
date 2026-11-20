export function baixarArquivo(arquivo, nome) {
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement('a');
    link.href = url; link.download = nome;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
