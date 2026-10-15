const { Router } = require('express');
const { listarTurmas, listarTurmasRegularesPorTurno } = require('../controllers/turmaController');

const router = Router();

router.get('/turmas', listarTurmas);
router.get('/turmas/regulares', listarTurmasRegularesPorTurno);

module.exports = router;