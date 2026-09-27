const { Router } = require('express');
const { listarTurmas } = require('../controllers/turmaController');

const router = Router();

router.get('/turmas', listarTurmas);

module.exports = router;