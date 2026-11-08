const origemFrontend = process.env.APP_ORIGIN;

if (!origemFrontend) {
  throw new Error('Configure APP_ORIGIN antes de iniciar a API.');
}

function exigirOrigemPermitida(req, res, next) {
  if (req.get('Origin') !== origemFrontend) {
    return res.status(403).json({
      erro: 'Origem da requisição não permitida.',
    });
  }

  return next();
}

module.exports = { exigirOrigemPermitida };