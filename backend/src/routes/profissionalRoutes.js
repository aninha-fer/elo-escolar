const { Router } = require('express');
const { exigirPermissao } = require('../middlewares/exigirPermissao');
const {
  listarProfissionais,
  criarProfissional,
  editarProfissional,
  excluirProfissional,
} = require('../controllers/profissionalController');

const router = Router();

router.use(exigirPermissao('administracao:acessar'));
router.get('/profissionais', listarProfissionais);
router.post('/profissionais', criarProfissional);
router.patch('/profissionais/:id', editarProfissional);
router.delete('/profissionais/:id', excluirProfissional);

module.exports = router;
