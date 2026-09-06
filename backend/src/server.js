require('dotenv').config();
const express = require('express');
const cors = require('cors');
const alunoRoutes = require('./routes/alunoRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', alunoRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API Elo Escolar operando.' });
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});