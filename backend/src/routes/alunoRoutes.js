const { Router } = require('express');
const { editarAluno, criarAluno, listarAlunos, obterAluno, obterOficinas, obterAtendimentos } = require('../controllers/alunoController');
const { obterAgenda } = require('../controllers/agendaController');
const { exigirPermissao } = require('../middlewares/exigirPermissao');

const alunoLeituraRoutes = Router();
const alunoAdminRoutes = Router();
const lerAlunos = exigirPermissao('alunos:ler');

alunoAdminRoutes.post('/alunos', criarAluno);
alunoAdminRoutes.patch('/alunos/:id', exigirPermissao('administracao:acessar'), editarAluno);
alunoLeituraRoutes.get('/alunos', lerAlunos, listarAlunos); 
alunoLeituraRoutes.get('/alunos/:id', lerAlunos, obterAluno); 
alunoLeituraRoutes.get('/alunos/:id/agenda', lerAlunos, obterAgenda);
alunoLeituraRoutes.get('/alunos/:id/oficinas', lerAlunos, obterOficinas);
alunoLeituraRoutes.get('/alunos/:id/atendimentos', lerAlunos, obterAtendimentos);

module.exports = { alunoLeituraRoutes, alunoAdminRoutes };