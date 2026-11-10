const { Router } = require('express');
const { exigirPermissao } = require('../middlewares/exigirPermissao');
const {
  listarProfissionais,
  criarProfissional
} = require('../controllers/profissionalController');

const router = Router();

router.use(exigirPermissao('administracao:acessar'));
router.get('/profissionais', listarProfissionais);
router.post('/profissionais', criarProfissional);

module.exports = router;
