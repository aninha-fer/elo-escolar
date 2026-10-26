const { Router } = require('express');
const { criarAtendimento, listarProfissionais } = require('../controllers/atendimentoController');

const router = Router();

router.post('/atendimentos', criarAtendimento);
router.get('/atendimentos/profissionais', listarProfissionais); //alterar depois para /profissionais, mas por enquanto está assim para não quebrar o front-end

module.exports = router;
