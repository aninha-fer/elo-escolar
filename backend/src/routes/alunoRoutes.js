const { Router } = require('express');
const { editarAluno, criarAluno, listarAlunos, obterAluno, obterOficinas, obterAtendimentos, alterarStatusAluno, excluirAluno } = require('../controllers/alunoController');
const { obterAgenda } = require('../controllers/agendaController');
const { exigirPermissao } = require('../middlewares/exigirPermissao');

const alunoLeituraRoutes = Router();
const alunoAdminRoutes = Router();
const lerAlunos = exigirPermissao('alunos:ler');
const exportacaoCalendario = require('../controllers/exportacaoCalendarioController');

alunoLeituraRoutes.get('/alunos/exportacao/selecionados', lerAlunos, exportacaoCalendario.selecionar);
alunoLeituraRoutes.get('/alunos/exportacao/calendarios', lerAlunos, exportacaoCalendario.lote);
alunoLeituraRoutes.get('/alunos/:id/calendario-exportacao', lerAlunos, exportacaoCalendario.individual);

alunoAdminRoutes.post('/alunos', criarAluno);
alunoAdminRoutes.patch('/alunos/:id', exigirPermissao('administracao:acessar'), editarAluno);
alunoAdminRoutes.patch('/alunos/:id/status', exigirPermissao('administracao:acessar'), alterarStatusAluno);
alunoAdminRoutes.delete('/alunos/:id', exigirPermissao('administracao:acessar'), excluirAluno);
alunoLeituraRoutes.get('/alunos', lerAlunos, listarAlunos); 
alunoLeituraRoutes.get('/alunos/:id', lerAlunos, obterAluno); 
alunoLeituraRoutes.get('/alunos/:id/agenda', lerAlunos, obterAgenda);
alunoLeituraRoutes.get('/alunos/:id/oficinas', lerAlunos, obterOficinas);
alunoLeituraRoutes.get('/alunos/:id/atendimentos', lerAlunos, obterAtendimentos);

module.exports = { alunoLeituraRoutes, alunoAdminRoutes };
