const { Router } = require('express');
const { listarTurmas, listarTurmasRegularesPorTurno } = require('../controllers/turmaController');
const { exigirPermissao } = require('../middlewares/exigirPermissao');

const turmaLeituraRoutes = Router();
const turmaAdminRoutes = Router();
const lerTurmas = exigirPermissao('turmas:ler');

turmaLeituraRoutes.get('/turmas', lerTurmas, listarTurmas);
turmaLeituraRoutes.get('/turmas/regulares', lerTurmas, listarTurmasRegularesPorTurno);

module.exports = { turmaLeituraRoutes, turmaAdminRoutes };