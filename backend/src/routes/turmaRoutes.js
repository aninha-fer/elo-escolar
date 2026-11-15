const { Router } = require('express');
const { listarTurmas, listarTurmasRegularesPorTurno, criarTurma, obterTurma, editarTurma } = require('../controllers/turmaController');
const { exigirPermissao } = require('../middlewares/exigirPermissao');

const turmaLeituraRoutes = Router();
const turmaAdminRoutes = Router();
const lerTurmas = exigirPermissao('turmas:ler');

turmaLeituraRoutes.get('/turmas', lerTurmas, listarTurmas);
turmaLeituraRoutes.get('/turmas/regulares', lerTurmas, listarTurmasRegularesPorTurno);
turmaLeituraRoutes.get('/turmas/:id', lerTurmas, obterTurma);

turmaAdminRoutes.post('/turmas', criarTurma);
turmaAdminRoutes.patch('/turmas/:id', exigirPermissao('administracao:acessar'), editarTurma);

module.exports = { turmaLeituraRoutes, turmaAdminRoutes };
