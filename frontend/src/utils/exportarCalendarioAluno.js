import { CORES_OFICINAS, DIAS_OFICINAS } from './calendarioOficinas.js';

const DIAS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const data = (valor) => valor.split('-').reverse().join('/');
const periodo = (turno) => turno === 'TARDE' ? 'Tarde' : turno === 'MANHA' ? 'Manhã' : 'Não informado';

export function nomeArquivoAluno(nome, id, usados = new Set()) {
    const encoder = new TextEncoder();
    let bytes = 0;
    let base = Array.from(nome.normalize('NFC')).filter((c) => c.codePointAt(0) >= 32 && !'<>:"/\\|?*'.includes(c))
        .filter((c) => { bytes += encoder.encode(c).length; return bytes <= 180; }).join('').trim().replace(/[. ]+$/g, '') || 'Aluno';
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base)) base = `Aluno ${base}`;
    let candidato = `${base}.pdf`, indice = 1;
    while (usados.has(candidato.toLocaleLowerCase('pt-BR'))) candidato = `${base}-${id}${indice++ > 1 ? `-${indice - 1}` : ''}.pdf`;
    usados.add(candidato.toLocaleLowerCase('pt-BR'));
    return candidato;
}

export async function criarPdfCalendarioAluno(calendario) {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: false });
    const margem = 12, largura = 186, fim = 283, alturaLinha = 3.4;
    let y;
    function cabecalho() {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.setTextColor('#1E293B');
        const nome = pdf.splitTextToSize(calendario.aluno.nome, largura);
        pdf.text(nome, margem, 16);
        y = 16 + nome.length * 5;
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor('#64748B');
        pdf.text(`${data(calendario.data_referencia)}`, margem, y);
        y += 8;
    }
    function novaPagina() { pdf.addPage(); cabecalho(); }
    function titulo(texto) {
        if (y + 12 > fim) novaPagina();
        pdf.setTextColor('#1E293B'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10);
        pdf.text(texto, margem, y); y += 6;
    }
    function bloco(nome, linhas, provisorio) {
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
        const partes = [{ texto: `${nome}${provisorio ? ' · Provisório' : ''}`, destaque: true }, ...linhas.map((texto) => ({ texto, destaque: false }))]
            .flatMap((item) => {
                pdf.setFont('helvetica', item.destaque ? 'bold' : 'normal');
                return pdf.splitTextToSize(item.texto, largura - 6).map((texto) => ({ texto, destaque: item.destaque }));
            });
        if (y + partes.length * alturaLinha + 5 > fim && partes.length * alturaLinha + 5 < fim - 40) novaPagina();
        for (const item of partes) {
            if (y + alturaLinha > fim) novaPagina();
            pdf.setFont('helvetica', item.destaque ? 'bold' : 'normal'); pdf.setFontSize(8);
            pdf.setTextColor(item.destaque ? '#1E293B' : '#475569'); pdf.text(item.texto, margem + 2, y); y += alturaLinha;
        }
        y += 3; pdf.setDrawColor('#E2E8F0'); pdf.line(margem, y, margem + largura, y); y += 5;
    }

    cabecalho();
    const coluna = largura / 5;
    const cartas = DIAS_OFICINAS.map((dia) => calendario.oficinas.flatMap((oficina) => oficina.horarios
        .filter((horario) => horario.dia_semana === dia.numero).map((horario) => ({ ...oficina, ...horario })))
        .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((oficina) => {
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5);
            return { cores: CORES_OFICINAS[oficina.turno === 'TARDE' ? 1 : 0], linhas: [oficina.nome, `${periodo(oficina.turno)} · ${oficina.inicio} - ${oficina.fim}`,
                `Prof.: ${oficina.profissional}`, ...(oficina.provisorio ? ['Provisório'] : [])].flatMap((texto) => pdf.splitTextToSize(texto, coluna - 6)) };
        }));
    let continuar;
    do {
        titulo('Oficinas — segunda a sexta');
        const topo = y;
        const alturaConteudo = Math.max(...cartas.map((dia) => 11 + dia.reduce((total, carta) => total + carta.linhas.length * 3.1 + 6, 0)));
        const altura = Math.min(Math.max(30, alturaConteudo), fim - topo - 9), base = topo + altura;
        continuar = false;
        DIAS_OFICINAS.forEach((dia, indice) => {
            const x = margem + indice * coluna;
            pdf.setFillColor('#F1F5F9'); pdf.setDrawColor('#E2E8F0'); pdf.rect(x, topo, coluna, altura, 'S'); pdf.rect(x, topo, coluna, 7, 'F');
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor('#334155'); pdf.text(DIAS[dia.numero], x + 2, topo + 5);
            let posicao = topo + 9;
            if (!cartas[indice].length) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor('#94A3B8'); pdf.text('Sem oficinas', x + 2, posicao + 4); }
            while (cartas[indice].length) {
                const carta = cartas[indice][0];
                const disponivel = Math.floor((base - posicao - 5) / 3.1);
                if (disponivel < 1 || (carta.linhas.length > disponivel && posicao > topo + 9)) break;
                const linhas = carta.linhas.splice(0, disponivel), h = linhas.length * 3.1 + 4;
                pdf.setFillColor(carta.cores.fundo); pdf.setDrawColor(carta.cores.borda); pdf.roundedRect(x + 1, posicao, coluna - 2, h, 1, 1, 'FD');
                pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(carta.cores.texto);
                linhas.forEach((linha, n) => pdf.text(linha, x + 3, posicao + 3.5 + n * 3.1));
                posicao += h + 2;
                if (!carta.linhas.length) cartas[indice].shift();
                else break;
            }
            if (cartas[indice].length) continuar = true;
        });
        y = base + 9;
        if (continuar) novaPagina();
    } while (continuar);

    titulo('Turma regular');
    if (!calendario.turmas_regulares.length) bloco('Sem turma.', []);
    for (const turma of calendario.turmas_regulares) {
        const grupos = new Map();
        for (const horario of turma.horarios) {
            const chave = `${horario.inicio} - ${horario.fim}`;
            grupos.set(chave, [...(grupos.get(chave) ?? []), DIAS[horario.dia_semana]]);
        }
        bloco(turma.nome, [`Profissionais: ${turma.profissional}`, `Sala: ${turma.sala}`,
            ...[...grupos].map(([horario, dias]) => `${dias.join(', ')}: ${horario}`)], turma.provisorio);
    }
    titulo('Atendimentos clínicos');
    if (!calendario.atendimentos.length) bloco('Sem atendimentos clínicos.', []);
    for (const atendimento of calendario.atendimentos) {
        const eventual = atendimento.tipo_recorrencia === 'EVENTUAL', mensal = atendimento.tipo_recorrencia === 'MENSAL';
        const recorrencia = eventual ? `Eventual em ${data(atendimento.proxima_data)}`
            : `${mensal ? 'Mensal' : 'Semanal'} · a cada ${atendimento.frequencia} ${mensal ? 'mês(es)' : 'semana(s)'}`;
        const diaProximo = DIAS[new Date(`${atendimento.proxima_data}T00:00:00Z`).getUTCDay() || 7];
        const dias = mensal ? `Dias variáveis conforme o mês; próxima: ${diaProximo}, ${data(atendimento.proxima_data)}` : atendimento.dias_semana.map((d) => DIAS[d]).join(', ');
        bloco(atendimento.modalidade, [`Profissional: ${atendimento.profissional}`, `${dias} · ${atendimento.hora_inicio} · ${atendimento.duracao_minutos} minutos`,
            `Recorrência: ${recorrencia}`], atendimento.provisorio);
    }
    for (let pagina = 1; pagina <= pdf.getNumberOfPages(); pagina++) {
        pdf.setPage(pagina); pdf.setFontSize(7); pdf.setTextColor('#64748B');
        pdf.text(`${pagina}/${pdf.getNumberOfPages()}`, 198, 290, { align: 'right' });
    }
    return pdf;
}
