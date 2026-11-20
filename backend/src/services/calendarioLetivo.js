const { agoraInstituicao } = require('./encerramentoAtividade');

const DIA_MS = 86400000;

function hojeInstituicao() {
  const hoje = agoraInstituicao();
  hoje.setUTCHours(0, 0, 0, 0);
  return hoje;
}

function contemData(calendario, data) {
  return Boolean(calendario && data >= calendario.data_inicio && data <= calendario.data_fim);
}

function turmaExpirada(turma, hoje = hojeInstituicao()) {
  return turma.tipo === 'REGULAR' && Boolean(turma.ano_letivo && turma.ano_letivo.data_fim < hoje);
}

function comExpiracao(turma) {
  return turma ? { ...turma, expirada: turmaExpirada(turma) } : turma;
}

function diaLetivo(calendarios, data) {
  return calendarios.some((calendario) => contemData(calendario, data));
}

function fimLetivo(calendarios, data, fim) {
  const periodos = calendarios.filter((calendario) => contemData(calendario, data));
  return periodos.length ? Math.min(fim, Math.max(...periodos.map((c) => +c.data_fim)) + DIA_MS) : +data;
}

function inicioMatriculaRegular(turma, minimo = hojeInstituicao()) {
  const calendario = turma.ano_letivo;
  const inicio = new Date(Math.max(hojeInstituicao().getTime(), minimo.getTime(), calendario?.data_inicio?.getTime() ?? 0));
  if (!calendario || inicio > calendario.data_fim) {
    throw Object.assign(new Error(`${turma.nome}: selecione uma turma regular com calendário letivo não encerrado.`), { statusCode: 409 });
  }
  return inicio;
}

// Leitura compartilhada permite inscrições simultâneas; alterações de calendário são exclusivas.
// Deve ser o primeiro bloqueio de qualquer transação que possa acrescentar compromissos.
async function bloquearCalendarios(tx, exclusivo = false) {
  if (exclusivo) await tx.$queryRaw`SELECT 1 AS bloqueado FROM pg_advisory_xact_lock(20261120, 1)`;
  else await tx.$queryRaw`SELECT 1 AS bloqueado FROM pg_advisory_xact_lock_shared(20261120, 1)`;
}

module.exports = { DIA_MS, hojeInstituicao, contemData, diaLetivo, fimLetivo, inicioMatriculaRegular, bloquearCalendarios, turmaExpirada, comExpiracao };
