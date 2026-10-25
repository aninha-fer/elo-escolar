const { Router } = require('express');
const { criarAtendimento } = require('../controllers/atendimentoController');

const router = Router();

router.post('/atendimentos', criarAtendimento);

module.exports = router;