const { promisify } = require('node:util');
const { verificarCredenciais } = require('../services/authService');

async function login(req, res) {
  if (!req.session) {
    return res.status(503).json({ erro: 'Sessão indisponível.' });
  }

  const usuario = await verificarCredenciais(req.loginValidado);

  if (!usuario) {
    return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
  }

  await promisify(req.session.regenerate).call(req.session);

  req.session.usuarioId = usuario.id;
  req.session.autenticadoEm = Date.now();

  await promisify(req.session.save).call(req.session);

  return res.status(200).json(usuario);
}

function me(req, res) {
  return res.status(200).json(req.usuario);
}

async function logout(req, res) {
  await promisify(req.session.destroy).call(req.session);

  res.clearCookie('elo.sid', { path: '/api' });
  return res.status(204).end();
}

module.exports = { login, me, logout };