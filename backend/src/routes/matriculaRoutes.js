const { Router } = require('express');
const { criarMatriculasOficinas } = require('../controllers/matriculaController');

const router = Router();

router.post('/matriculas/oficinas', criarMatriculasOficinas);

module.exports = router;