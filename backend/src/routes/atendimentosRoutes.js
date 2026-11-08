const { Router } = require('express');
const { criarAtendimento, listarProfissionais, removerAtendimentoProvisorio } = require('../controllers/atendimentoController');
const { exigirPermissao } = require('../middlewares/exigirPermissao');

const router = Router();

router.use(exigirPermissao('administracao:acessar'));
router.post('/atendimentos', criarAtendimento);
router.delete('/alunos/:aluno_id/atendimentos/:atendimento_id/provisorio', removerAtendimentoProvisorio);
router.get('/atendimentos/profissionais', listarProfissionais); //alterar depois para /profissionais, mas por enquanto está assim para não quebrar o front-end

module.exports = router;
