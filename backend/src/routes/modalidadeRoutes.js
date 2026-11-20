const router = require('express').Router();
const { exigirPermissao } = require('../middlewares/exigirPermissao');
const { listar, criar } = require('../controllers/modalidadeController');

router.use(exigirPermissao('administracao:acessar'));
router.get('/modalidades', listar);
router.post('/modalidades', criar);

module.exports = router;
