const { Router } = require('express');
const { criarAtendimento, removerAtendimentoProvisorio } = require('../controllers/atendimentoController');
const { exigirPermissao } = require('../middlewares/exigirPermissao');

const router = Router();

router.use(exigirPermissao('administracao:acessar'));
router.post('/atendimentos', criarAtendimento);
router.delete('/alunos/:aluno_id/atendimentos/:atendimento_id/provisorio', removerAtendimentoProvisorio);

module.exports = router;
