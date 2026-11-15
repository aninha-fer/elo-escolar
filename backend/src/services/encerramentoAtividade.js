const DIA_MS = 86400000;

function agoraInstituicao() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  return new Date(`${valor('year')}-${valor('month')}-${valor('day')}T${valor('hour')}:${valor('minute')}:${valor('second')}.000Z`);
}

function inicioOcorrencia(data, hora) {
  return data.getTime() + hora.getUTCHours() * 3600000 + hora.getUTCMinutes() * 60000;
}

function dataEncerramento(ocorrencias, agora = agoraInstituicao()) {
  const hoje = new Date(agora);
  hoje.setUTCHours(0, 0, 0, 0);
  const ocorreu = ocorrencias.some(({ data, hora }) => data.getTime() === hoje.getTime() && inicioOcorrencia(data, hora) <= agora.getTime());
  return new Date(hoje.getTime() - (ocorreu ? 0 : DIA_MS));
}

function fimMatricula(matricula, agora = agoraInstituicao()) {
  const hoje = new Date(agora);
  hoje.setUTCHours(0, 0, 0, 0);
  const ocorrencias = (!matricula.data_inicio || matricula.data_inicio <= hoje)
    ? matricula.turma.horarios.filter((h) => h.dia_semana === (hoje.getUTCDay() || 7))
      .map((h) => ({ data: hoje, hora: h.hora_inicio })) : [];
  const fim = dataEncerramento(ocorrencias, agora);
  return matricula.data_fim && matricula.data_fim < fim ? matricula.data_fim : fim;
}

module.exports = { agoraInstituicao, inicioOcorrencia, dataEncerramento, fimMatricula, DIA_MS };
