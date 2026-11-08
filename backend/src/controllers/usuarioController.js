const { criarUsuarioDTO, buscarPessoasElegiveisDTO } = require('../dtos/usuarioDTO');
const usuariosService = require('../services/usuarioService');

function responderErro(res, erro) {
  if (erro instanceof usuariosService.ErroUsuario) {
    return res.status(erro.statusCode).json({ erro: erro.message });
  }

  console.error('Falha em uma operação de usuários.', {
    nome: erro.name,
    codigo: erro.code,
  });

  return res.status(500).json({ erro: 'Erro interno no servidor.' });
}

async function listarUsuarios(req, res) {
  try {
    const usuarios = await usuariosService.listarUsuarios();
    return res.json(usuarios);
  } catch (erro) {
    return responderErro(res, erro);
  }
}

async function buscarPessoasElegiveis(req, res) {
  const resultado = buscarPessoasElegiveisDTO.safeParse(req.query);

  if (!resultado.success) {
    return res.status(400).json({ erro: 'Informe um termo de busca entre 2 e 100 caracteres.' });
  }

  try {
    const pessoas = await usuariosService.buscarPessoasElegiveis(resultado.data.q);
    return res.json(pessoas);
  } catch (erro) {
    return responderErro(res, erro);
  }
}

async function criarUsuario(req, res) {
  const resultado = criarUsuarioDTO.safeParse(req.body);

  if (!resultado.success) {
    const erros = resultado.error.issues.map(({ path, code, message }) => ({
      campo: path.join('.'),
      mensagem: code === 'unrecognized_keys' ? 'Há campos não permitidos.' : message,
    }));

    return res.status(400).json({ erro: 'Dados inválidos para criar o usuário.', erros });
  }

  try {
    const usuario = await usuariosService.criarUsuario(resultado.data);
    return res.status(201).json(usuario);
  } catch (erro) {
    return responderErro(res, erro);
  }
}

module.exports = { listarUsuarios, buscarPessoasElegiveis, criarUsuario };
