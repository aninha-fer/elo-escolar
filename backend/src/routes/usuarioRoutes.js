const { Router } = require('express');
const { exigirPermissao } = require('../middlewares/exigirPermissao');
const {
  listarUsuarios,
  criarUsuario,
  editarUsuario,
} = require('../controllers/usuarioController');

const router = Router();

router.use(exigirPermissao('administracao:acessar'));
router.get('/usuarios', listarUsuarios);
router.post('/usuarios', criarUsuario);
router.patch('/usuarios/:id', editarUsuario);

module.exports = router;
