const { Router } = require('express');
const { criarAluno, listarAlunos, obterAluno, obterOficinas } = require('../controllers/alunoController');
const { obterAgenda } = require('../controllers/agendaController');

const router = Router();

router.post('/alunos', criarAluno);
router.get('/alunos', listarAlunos); 
router.get('/alunos/:id', obterAluno); 
router.get('/alunos/:id/agenda', obterAgenda);
router.get('/alunos/:id/oficinas', obterOficinas);

module.exports = router;