const { Router } = require('express');
const { listarTurmas, listarTurmasRegularesPorTurno, criarTurma, obterTurma, editarTurma, excluirTurma, prepararNovaTurma, criarTurmaAPartir } = require('../controllers/turmaController');
const { exigirPermissao } = require('../middlewares/exigirPermissao');

const turmaLeituraRoutes = Router();
const turmaAdminRoutes = Router();
const lerTurmas = exigirPermissao('turmas:ler');

turmaLeituraRoutes.get('/turmas', lerTurmas, listarTurmas);
turmaLeituraRoutes.get('/turmas/regulares', lerTurmas, listarTurmasRegularesPorTurno);
turmaLeituraRoutes.get('/turmas/:id', lerTurmas, obterTurma);

turmaAdminRoutes.post('/turmas', criarTurma);
turmaAdminRoutes.get('/turmas/:id/nova-turma', exigirPermissao('administracao:acessar'), prepararNovaTurma);
turmaAdminRoutes.post('/turmas/:id/nova-turma', exigirPermissao('administracao:acessar'), criarTurmaAPartir);
turmaAdminRoutes.patch('/turmas/:id', exigirPermissao('administracao:acessar'), editarTurma);
turmaAdminRoutes.delete('/turmas/:id', exigirPermissao('administracao:acessar'), excluirTurma);

module.exports = { turmaLeituraRoutes, turmaAdminRoutes };
