function exigirSenhaDefinitiva(req, res, next) {
    if (req.usuario.deve_trocar_senha) {
        return res.status(403).json({ codigo: 'TROCA_SENHA_OBRIGATORIA', erro: 'Defina uma nova senha antes de continuar.' });
    }
    return next();
}

module.exports = { exigirSenhaDefinitiva };
