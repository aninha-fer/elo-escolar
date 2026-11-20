export function hojeInstituicao() {
    const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
    return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

export function periodoLetivo(calendario) {
    const formatar = (data) => data.slice(0, 10).split('-').reverse().join('/');
    return `${formatar(calendario.data_inicio)} — ${formatar(calendario.data_fim)}`;
}
