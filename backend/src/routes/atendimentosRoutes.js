const { Router } = require('express');
const { criarAtendimento, removerAtendimentoProvisorio, obterAtendimento, editarAtendimento, cancelarAtendimento } = require('../controllers/atendimentoController');
const { exigirPermissao } = require('../middlewares/exigirPermissao');

const router = Router();

router.use(exigirPermissao('administracao:acessar'));
router.post('/atendimentos', criarAtendimento);
router.get('/alunos/:aluno_id/atendimentos/:atendimento_id', obterAtendimento);
router.patch('/alunos/:aluno_id/atendimentos/:atendimento_id', editarAtendimento);
router.patch('/alunos/:aluno_id/atendimentos/:atendimento_id/cancelamento', cancelarAtendimento);
router.delete('/alunos/:aluno_id/atendimentos/:atendimento_id/provisorio', removerAtendimentoProvisorio);

module.exports = router;
