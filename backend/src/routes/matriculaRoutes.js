const { Router } = require('express');
const { criarMatriculasOficinas, cancelarInscricaoOficina } = require('../controllers/matriculaController');

const router = Router();

router.post('/matriculas/oficinas', criarMatriculasOficinas);
router.patch('/matriculas/oficinas/:matricula_id/cancelamento', cancelarInscricaoOficina);

module.exports = router;
