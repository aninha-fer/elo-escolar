const { promisify } = require('node:util');
const { verificarCredenciais, removerVersao, trocarSenhaInicial } = require('../services/authService');
const { trocarSenhaInicialDTO } = require('../dtos/authDTO');
const { registrarAtividade, encerrarSessao } = require('../services/sessaoService');

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
  req.session.ultimaAtividadeEm = req.session.autenticadoEm;
  req.session.senha_versao = usuario.senha_versao;

  await promisify(req.session.save).call(req.session);

  return res.status(200).json(removerVersao(usuario));
}

function me(req, res) {
  return res.status(200).json(removerVersao(req.usuario));
}

async function atividade(req, res) {
  try {
    // Não alterar req.session: o save automático usa upsert e poderia desfazer um logout.
    if (!await registrarAtividade(req.sessionID, req.session)) return encerrarSessao(req, res);
    return res.status(204).end();
  } catch {
    return res.status(503).json({ erro: 'Não foi possível registrar a atividade. Tente novamente.' });
  }
}

async function logout(req, res) {
  await promisify(req.session.destroy).call(req.session);

  res.clearCookie('elo.sid', { path: '/api' });
  return res.status(204).end();
}

async function alterarSenhaInicial(req, res) {
  const validado = trocarSenhaInicialDTO.safeParse(req.body);
  if (!validado.success) return res.status(400).json({ erros: validado.error.issues.map((item) => ({ campo: item.path[0], mensagem: item.message })) });
  let usuario;
  try {
    usuario = await trocarSenhaInicial(req.usuario.id, req.session.senha_versao, validado.data.nova_senha);
  } catch (erro) {
    if (erro.statusCode) return res.status(erro.statusCode).json({ erro: erro.message });
    return res.status(500).json({ erro: 'Não foi possível alterar a senha. Tente novamente.' });
  }
  try {
    await promisify(req.session.regenerate).call(req.session);
    req.session.usuarioId = usuario.id;
    req.session.autenticadoEm = Date.now();
    req.session.ultimaAtividadeEm = req.session.autenticadoEm;
    req.session.senha_versao = usuario.senha_versao;
    await promisify(req.session.save).call(req.session);
  } catch {
    if (req.session) await promisify(req.session.destroy).call(req.session).catch(() => {});
    res.clearCookie('elo.sid', { path: '/api' });
    return res.status(401).json({ codigo: 'SENHA_ALTERADA_NOVO_LOGIN', erro: 'Senha alterada. Entre novamente com sua nova senha.' });
  }
  return res.status(200).json(removerVersao(usuario));
}

module.exports = { login, me, logout, alterarSenhaInicial, atividade };
