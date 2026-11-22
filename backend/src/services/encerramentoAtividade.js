const DIA_MS = 86400000;

function agoraInstituicao(instante = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(instante);
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  return new Date(`${valor('year')}-${valor('month')}-${valor('day')}T${valor('hour')}:${valor('minute')}:${valor('second')}.000Z`);
}

function inicioOcorrencia(data, hora) {
  return data.getTime() + hora.getUTCHours() * 3600000 + hora.getUTCMinutes() * 60000;
}

function recorrenciaVencida(atendimento, agora = agoraInstituicao()) {
  const hoje = new Date(agora);
  hoje.setUTCHours(0, 0, 0, 0);
  return ['SEMANAL', 'MENSAL'].includes(atendimento.tipo_recorrencia)
    && Boolean(atendimento.data_termino && atendimento.data_termino < hoje);
}

function filtroMatriculasAtivas(agora = agoraInstituicao()) {
  const hoje = new Date(agora);
  hoje.setUTCHours(0, 0, 0, 0);
  return { status: 'ATIVO', OR: [{ data_fim: null }, { data_fim: { gte: hoje } }] };
}

function matriculaVigente(matricula, agora = agoraInstituicao()) {
  const hoje = new Date(agora);
  hoje.setUTCHours(0, 0, 0, 0);
  return matricula.status === 'PROVISORIO' ? !matricula.data_fim
    : matricula.status === 'ATIVO' && (!matricula.data_fim || matricula.data_fim >= hoje);
}

function dataEncerramento(ocorrencias, agora = agoraInstituicao()) {
  const hoje = new Date(agora);
  hoje.setUTCHours(0, 0, 0, 0);
  const ocorreu = ocorrencias.some(({ data, hora }) => data.getTime() === hoje.getTime() && inicioOcorrencia(data, hora) <= agora.getTime());
  return new Date(hoje.getTime() - (ocorreu ? 0 : DIA_MS));
}

function fimMatricula(matricula, agora = agoraInstituicao(), limite) {
  const hoje = new Date(agora);
  hoje.setUTCHours(0, 0, 0, 0);
  const ocorrencias = (!matricula.data_inicio || matricula.data_inicio <= hoje)
    ? matricula.turma.horarios.filter((h) => h.dia_semana === (hoje.getUTCDay() || 7))
      .map((h) => ({ data: hoje, hora: h.hora_inicio })) : [];
  const fim = dataEncerramento(ocorrencias, agora);
  return new Date(Math.min(fim.getTime(), matricula.data_fim?.getTime() ?? Infinity, limite?.getTime() ?? Infinity));
}

module.exports = { agoraInstituicao, inicioOcorrencia, recorrenciaVencida, filtroMatriculasAtivas, matriculaVigente, dataEncerramento, fimMatricula, DIA_MS };
