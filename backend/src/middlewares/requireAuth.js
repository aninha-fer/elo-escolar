const { promisify } = require('node:util');
const { buscarIdentidadePorId } = require('../services/authService');

const DURACAO_MAXIMA_MS = 8 * 60 * 60 * 1000;
const SEM_SESSAO = { erro: 'Sessão inválida ou expirada.' };

async function requireAuth(req, res, next) {
  const { usuarioId, autenticadoEm } = req.session ?? {};

  if (!Number.isInteger(usuarioId)) {
    return res.status(401).json(SEM_SESSAO);
  }

  const dentroDoPrazo =
    Number.isFinite(autenticadoEm) &&
    Date.now() - autenticadoEm < DURACAO_MAXIMA_MS;

  const usuario = dentroDoPrazo
    ? await buscarIdentidadePorId(usuarioId)
    : null;

  if (!usuario) {
    await promisify(req.session.destroy).call(req.session);
    res.clearCookie('elo.sid', { path: '/api' });
    return res.status(401).json(SEM_SESSAO);
  }

  req.usuario = usuario;
  return next();
}

module.exports = { requireAuth };