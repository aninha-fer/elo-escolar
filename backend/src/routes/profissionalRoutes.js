const { Router } = require('express');
const { exigirPermissao } = require('../middlewares/exigirPermissao');
const {
  listarProfissionais,
  criarProfissional,
  editarProfissional,
} = require('../controllers/profissionalController');

const router = Router();

router.use(exigirPermissao('administracao:acessar'));
router.get('/profissionais', listarProfissionais);
router.post('/profissionais', criarProfissional);
router.patch('/profissionais/:id', editarProfissional);

module.exports = router;
