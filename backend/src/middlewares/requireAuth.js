const { buscarIdentidadePorId } = require('../services/authService');
const { sessaoDentroDoPrazo } = require('../config/prazosSessao');
const { encerrarSessao } = require('../services/sessaoService');

const SEM_SESSAO = { erro: 'Sessão inválida ou expirada.' };

async function requireAuth(req, res, next) {
  const { usuarioId } = req.session ?? {};

  if (!Number.isInteger(usuarioId)) {
    return res.status(401).json(SEM_SESSAO);
  }

  const dentroDoPrazo = sessaoDentroDoPrazo(req.session);

  const usuario = dentroDoPrazo
    ? await buscarIdentidadePorId(usuarioId)
    : null;

  if (!usuario || !Number.isInteger(req.session.senha_versao) || req.session.senha_versao !== usuario.senha_versao) {
    return encerrarSessao(req, res);
  }

  req.usuario = usuario;
  return next();
}

module.exports = { requireAuth };
