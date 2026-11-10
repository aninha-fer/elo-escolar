const { Router } = require('express');
const { criarMatriculasOficinas, cancelarInscricaoOficina, criarMatriculaRegular, removerMatriculaProvisoria } = require('../controllers/matriculaController');
const { exigirPermissao } = require('../middlewares/exigirPermissao');

const router = Router();

router.use(exigirPermissao('administracao:acessar'));
router.post('/matriculas/oficinas', criarMatriculasOficinas);
router.post('/matriculas/regular', criarMatriculaRegular);
router.delete('/alunos/:aluno_id/matriculas/:matricula_id/provisorio', removerMatriculaProvisoria);
router.patch('/matriculas/oficinas/:matricula_id/cancelamento', cancelarInscricaoOficina);

module.exports = router;
