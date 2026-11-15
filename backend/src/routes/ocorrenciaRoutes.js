const { Router } = require('express');
const controller = require('../controllers/ocorrenciaController');
const { exigirPermissao } = require('../middlewares/exigirPermissao');

const router = Router();
const permissao = exigirPermissao('ocorrencias:gerenciar');
router.get('/alunos/:aluno_id/ocorrencias', permissao, controller.listarOcorrencias);
router.post('/alunos/:aluno_id/ocorrencias', permissao, controller.criarOcorrencia);
router.patch('/alunos/:aluno_id/ocorrencias/:ocorrencia_id', permissao, controller.editarOcorrencia);
router.delete('/alunos/:aluno_id/ocorrencias/:ocorrencia_id', permissao, controller.excluirOcorrencia);

module.exports = router;
