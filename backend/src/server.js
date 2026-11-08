require('dotenv').config();

const express = require('express');
const cors = require('cors');

const sessionMiddleware = require('./config/session');
const { requireAuth } = require('./middlewares/requireAuth');
const { exigirPermissao } = require('./middlewares/exigirPermissao');
const { exigirOrigemPermitida } = require('./middlewares/exigirOrigemPermitida');

const { authPublicas, authProtegidas } = require('./routes/authRoutes');
const { alunoLeituraRoutes, alunoAdminRoutes } = require('./routes/alunoRoutes');
const { turmaLeituraRoutes, turmaAdminRoutes } = require('./routes/turmaRoutes');
const matriculaRoutes = require('./routes/matriculaRoutes');
const atendimentosRoutes = require('./routes/atendimentosRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const profissionalRoutes = require('./routes/profissionalRoutes');

const app = express();

const trustProxyHops = process.env.TRUST_PROXY_HOPS;
if (trustProxyHops !== undefined) {
  const hops = Number(trustProxyHops);

  if (!Number.isSafeInteger(hops) || hops < 1) {
    throw new Error('TRUST_PROXY_HOPS deve ser um inteiro positivo.');
  }

  app.set('trust proxy', hops);
}

const api = express.Router();

app.use(cors({
  origin: process.env.APP_ORIGIN,
  credentials: true,
}));

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(express.json());

app.use('/api', sessionMiddleware);
app.use('/api/auth', authPublicas);
api.use(requireAuth);

api.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  return exigirOrigemPermitida(req, res, next);
});

// Rotas com permissão de leitura
api.use('/auth', authProtegidas);
api.use(alunoLeituraRoutes);
api.use(turmaLeituraRoutes);

// Rotas com permissão de administração
api.use(exigirPermissao('administracao:acessar'));
api.use(alunoAdminRoutes);
api.use(matriculaRoutes);
api.use(atendimentosRoutes);
app.use(turmaAdminRoutes);
api.use(usuarioRoutes);
api.use(profissionalRoutes);

api.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'API Elo Escolar operando.' });
});
app.use('/api', api);
const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});