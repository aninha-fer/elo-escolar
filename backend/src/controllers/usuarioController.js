const { criarUsuarioDTO, editarUsuarioDTO, editarUsuarioParamsDTO } = require('../dtos/usuarioDTO');
const usuariosService = require('../services/usuarioService');
const { lerPaginacao } = require('../dtos/paginacaoDTO');

function responderErro(res, erro) {
  if (erro.name === 'ZodError') return res.status(400).json({ erros: erro.issues });
  if (erro instanceof usuariosService.ErroUsuario) {
    return res.status(erro.statusCode).json({
      erro: erro.message,
      ...(erro.campo ? { erros: [{ campo: erro.campo, mensagem: erro.message }] } : {}),
    });
  }

  if (erro.statusCode === 400) return res.status(400).json({ erro: erro.message });
  console.error('Falha em uma operação de usuários.', {
    nome: erro.name,
    codigo: erro.code,
  });

  return res.status(500).json({ erro: 'Erro interno no servidor.' });
}

async function listarUsuarios(req, res) {
  try {
    const usuarios = await usuariosService.listarUsuarios(lerPaginacao(req.query));
    return res.json(usuarios);
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

async function editarUsuario(req, res) {
  const parametros = editarUsuarioParamsDTO.safeParse(req.params);
  if (!parametros.success) {
    return res.status(400).json({ erro: 'ID do usuário inválido.' });
  }
  const resultado = editarUsuarioDTO.safeParse(req.body);

  if (!resultado.success) {
    const erros = resultado.error.issues.map(({ path, code, message }) => ({
      campo: path.join('.'),
      mensagem: code === 'unrecognized_keys' ? 'Há campos não permitidos.' : message,
    }));

    return res.status(400).json({ erro: 'Dados inválidos para editar o usuário.', erros });
  }

  try {
    const usuario = await usuariosService.editarUsuario(parametros.data.id, resultado.data);
    return res.status(200).json(usuario);
  } catch (erro) {
    return responderErro(res, erro);
  }
}

async function excluirUsuario(req, res) {
  const parametros = editarUsuarioParamsDTO.safeParse(req.params);
  if (!parametros.success) {
    return res.status(400).json({ erro: 'ID do usuário inválido.' });
  }

  try {
    await usuariosService.excluirUsuario(parametros.data.id);
    return res.status(204).send();
  } catch (erro) {
    return responderErro(res, erro);
  }
}

module.exports = { listarUsuarios, criarUsuario, editarUsuario, excluirUsuario };
