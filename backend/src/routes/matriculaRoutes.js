const { Router } = require('express');
const { criarMatriculasOficinas, cancelarInscricaoOficina, criarMatriculaRegular, removerMatriculaProvisoria } = require('../controllers/matriculaController');

const router = Router();

router.post('/matriculas/oficinas', criarMatriculasOficinas);
router.post('/matriculas/regular', criarMatriculaRegular);
router.delete('/alunos/:aluno_id/matriculas/:matricula_id/provisorio', removerMatriculaProvisoria);
router.patch('/matriculas/oficinas/:matricula_id/cancelamento', cancelarInscricaoOficina);

module.exports = router;
