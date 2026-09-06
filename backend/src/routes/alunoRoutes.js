const { Router } = require('express');
const { criarAluno } = require('../controllers/alunoController');

const router = Router();

router.post('/alunos', criarAluno);

module.exports = router;