const { Router } = require('express');
const { exigirPermissao } = require('../middlewares/exigirPermissao');
const {
  listarUsuarios,
  buscarPessoasElegiveis,
  criarUsuario,
} = require('../controllers/usuarioController');

const router = Router();

router.use(exigirPermissao('administracao:acessar'));
router.get('/usuarios', listarUsuarios);
router.post('/usuarios', criarUsuario);
router.get('/pessoas-elegiveis', buscarPessoasElegiveis);

module.exports = router;
