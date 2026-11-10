const { Router } = require('express');
const { listarAmbientes } = require('../controllers/ambienteController');
const { exigirPermissao } = require('../middlewares/exigirPermissao');

const router = Router();
router.get('/ambientes', exigirPermissao('administracao:acessar'), listarAmbientes);

module.exports = router;
