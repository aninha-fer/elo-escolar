const INATIVIDADE_MAXIMA_MS = 60 * 60 * 1000;
const DURACAO_MAXIMA_MS = 8 * 60 * 60 * 1000;

function sessaoDentroDoPrazo({ autenticadoEm, ultimaAtividadeEm } = {}, agora = Date.now()) {
  return Number.isFinite(autenticadoEm) && Number.isFinite(ultimaAtividadeEm)
    && autenticadoEm <= agora && ultimaAtividadeEm <= agora
    && agora - autenticadoEm < DURACAO_MAXIMA_MS
    && agora - ultimaAtividadeEm < INATIVIDADE_MAXIMA_MS;
}

module.exports = { INATIVIDADE_MAXIMA_MS, DURACAO_MAXIMA_MS, sessaoDentroDoPrazo };
