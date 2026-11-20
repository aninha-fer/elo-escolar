import { CORES_OFICINAS } from './calendarioOficinas.js';

export async function criarPdfCalendarioOficinas(dias, dataReferencia) {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const margem = 14, larguraDia = 25, intervalo = 3, alturaLinha = 4, colunas = 6;
    const largura = pdf.internal.pageSize.getWidth(), altura = pdf.internal.pageSize.getHeight();
    const larguraCard = (largura - 2 * margem - larguraDia - (colunas - 1) * intervalo) / colunas;
    let y;

    function cabecalho() {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17); pdf.setTextColor('#1E293B');
        pdf.text('Elo Escolar — Calendário de oficinas', margem, 17);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor('#64748B');
        pdf.text(`Grade semanal das oficinas ativas · ${dataReferencia.split('-').reverse().join('/')}`, margem, 24);
        y = 34;
    }

    function novaPagina() { pdf.addPage(); cabecalho(); }
    cabecalho();
    for (const dia of dias) {
        const lotes = dia.oficinas.length ? Array.from({ length: Math.ceil(dia.oficinas.length / colunas) }, (_, i) => dia.oficinas.slice(i * colunas, (i + 1) * colunas)) : [[]];
        for (let linha = 0; linha < lotes.length; linha++) {
            const preparados = lotes[linha].map((oficina) => {
                pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
                const nome = pdf.splitTextToSize(oficina.nome, larguraCard - 8);
                pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
                const detalhe = pdf.splitTextToSize(`${oficina.inicio} – ${oficina.fim} · ${oficina.sala}`, larguraCard - 8);
                return { ...oficina, linhas: [...nome.map((texto) => ({ texto, titulo: true })), ...detalhe.map((texto) => ({ texto, titulo: false }))] };
            });
            const totalLinhas = Math.max(2, ...preparados.map((o) => o.linhas.length));
            if (y + 10 + totalLinhas * alturaLinha > altura - margem && y > 34) novaPagina();
            let deslocamento = 0;
            while (deslocamento < totalLinhas) {
                const quantidade = Math.min(totalLinhas - deslocamento, Math.floor((altura - margem - y - 10) / alturaLinha));
                if (quantidade < 1) { novaPagina(); continue; }
                const alturaMaxima = Math.max(19, 10 + quantidade * alturaLinha);
                pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor('#1E293B');
                if (linha === 0 && deslocamento === 0) pdf.text(dia.nome, margem, y + 7);
                if (!preparados.length) {
                    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor('#64748B');
                    pdf.text('Nenhuma oficina programada.', margem + larguraDia + 4, y + 7);
                }
                preparados.forEach((oficina, indice) => {
                    const linhas = oficina.linhas.slice(deslocamento, deslocamento + quantidade);
                    if (!linhas.length) return;
                    const x = margem + larguraDia + indice * (larguraCard + intervalo), cores = CORES_OFICINAS[oficina.cor];
                    pdf.setFillColor(cores.fundo); pdf.setDrawColor(cores.borda);
                    pdf.roundedRect(x, y, larguraCard, alturaMaxima, 2, 2, 'FD');
                    linhas.forEach((item, numero) => {
                        pdf.setTextColor(item.titulo ? '#1E293B' : cores.texto);
                        pdf.setFont('helvetica', item.titulo ? 'bold' : 'normal'); pdf.setFontSize(item.titulo ? 11 : 9);
                        pdf.text(item.texto, x + 4, y + 6 + numero * alturaLinha);
                    });
                });
                deslocamento += quantidade;
                y += alturaMaxima + 4;
                if (deslocamento < totalLinhas) novaPagina();
            }
        }
        pdf.setDrawColor('#E2E8F0'); pdf.line(margem, y, largura - margem, y); y += 5;
    }
    const paginas = pdf.getNumberOfPages();
    for (let pagina = 1; pagina <= paginas; pagina++) {
        pdf.setPage(pagina); pdf.setTextColor('#64748B'); pdf.setFontSize(8);
        pdf.text(`${pagina}/${paginas}`, largura - margem, altura - 5, { align: 'right' });
    }
    return pdf;
}

export async function exportarCalendarioOficinas(dias, dataReferencia) {
    const pdf = await criarPdfCalendarioOficinas(dias, dataReferencia);
    pdf.save(`calendario-oficinas-${dataReferencia}.pdf`);
}
