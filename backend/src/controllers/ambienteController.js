const { listarAmbientesService } = require('../services/ambienteService');

async function listarAmbientes(req, res) {
    try {
        return res.status(200).json(await listarAmbientesService());
    } catch (error) {
        console.error('Erro ao listar ambientes.', { nome: error.name, codigo: error.code });
        return res.status(500).json({ erro: 'Não foi possível carregar as salas.' });
    }
}

module.exports = { listarAmbientes };
