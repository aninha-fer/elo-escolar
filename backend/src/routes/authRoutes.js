const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const { loginDTO } = require('../dtos/authDTO');
const { login, me, logout } = require('../controllers/authController');
const { exigirOrigemPermitida } = require('../middlewares/exigirOrigemPermitida');

const { exigirPermissao } = require('../middlewares/exigirPermissao');
const authPublicas = Router();
const authProtegidas = Router();

function validarLogin(req, res, next) {
  const resultado = loginDTO.safeParse(req.body);

  if (!resultado.success) {
    return res.status(400).json({ erro: 'Informe um e-mail válido e a senha.' });
  }

  req.loginValidado = resultado.data;
  return next();
}

const janelaMs = 15 * 60 * 1000;
const mensagemLimite = { erro: 'Muitas tentativas. Tente novamente mais tarde.' };

const limitarPorIp = rateLimit({
  windowMs: janelaMs,
  limit: 60,
  message: mensagemLimite,
});

const limitarPorEmail = rateLimit({
  windowMs: janelaMs,
  limit: 10,
  keyGenerator: (req) => req.loginValidado.email,
  skipSuccessfulRequests: true,
  message: mensagemLimite,
});

authPublicas.post('/login', exigirOrigemPermitida, limitarPorIp, validarLogin, limitarPorEmail, login);
authProtegidas.get('/me', exigirPermissao('sessao:gerenciar'), me);
authProtegidas.post('/logout', exigirPermissao('sessao:gerenciar'), logout);

module.exports = { authPublicas, authProtegidas };