const { Router } = require('express');
const { exigirPermissao } = require('../middlewares/exigirPermissao');
const {
  listarUsuarios,
  criarUsuario,
} = require('../controllers/usuarioController');

const router = Router();

router.use(exigirPermissao('administracao:acessar'));
router.get('/usuarios', listarUsuarios);
router.post('/usuarios', criarUsuario);

module.exports = router;
