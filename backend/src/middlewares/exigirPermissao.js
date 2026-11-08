const permissoesProfessor = new Set([
  'sessao:gerenciar',
  'alunos:ler',
  'turmas:ler',
]);

function exigirPermissao(permissao) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
    }

    const { role } = req.usuario;
    const permitido =
      role === 'admin' ||
      (role === 'professor' && permissoesProfessor.has(permissao));

    if (!permitido) {
      return res.status(403).json({ erro: 'Você não tem permissão para esta operação.' });
    }

    return next();
  };
}

module.exports = { exigirPermissao };