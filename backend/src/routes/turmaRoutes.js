const { Router } = require('express');
const { listarTurmas, listarTurmasRegularesPorTurno, criarTurma } = require('../controllers/turmaController');
const { exigirPermissao } = require('../middlewares/exigirPermissao');

const turmaLeituraRoutes = Router();
const turmaAdminRoutes = Router();
const lerTurmas = exigirPermissao('turmas:ler');

turmaLeituraRoutes.get('/turmas', lerTurmas, listarTurmas);
turmaLeituraRoutes.get('/turmas/regulares', lerTurmas, listarTurmasRegularesPorTurno);

turmaAdminRoutes.post('/turmas', criarTurma);

module.exports = { turmaLeituraRoutes, turmaAdminRoutes };
