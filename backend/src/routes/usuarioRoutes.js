const { Router } = require('express');
const { exigirPermissao } = require('../middlewares/exigirPermissao');
const {
  listarUsuarios,
  criarUsuario,
  editarUsuario,
  excluirUsuario,
} = require('../controllers/usuarioController');

const router = Router();

router.use(exigirPermissao('administracao:acessar'));
router.get('/usuarios', listarUsuarios);
router.post('/usuarios', criarUsuario);
router.patch('/usuarios/:id', editarUsuario);
router.delete('/usuarios/:id', excluirUsuario);

module.exports = router;
