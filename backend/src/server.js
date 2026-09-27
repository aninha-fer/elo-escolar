require('dotenv').config();
const express = require('express');
const cors = require('cors');
const alunoRoutes = require('./routes/alunoRoutes');
const turmaRoutes = require('./routes/turmaRoutes');
const matriculaRoutes = require('./routes/matriculaRoutes');

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/api', alunoRoutes);
app.use('/api', turmaRoutes);
app.use('/api', matriculaRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API Elo Escolar operando.' });
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});