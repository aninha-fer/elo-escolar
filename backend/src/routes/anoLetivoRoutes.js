const router = require('express').Router();
const { listar, criar, editar } = require('../controllers/anoLetivoController');

router.get('/anos-letivos', listar);
router.post('/anos-letivos', criar);
router.patch('/anos-letivos/:id', editar);

module.exports = router;
