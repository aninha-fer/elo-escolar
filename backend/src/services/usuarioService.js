const argon2 = require('argon2');
const prisma = require('../prismaClient');

const camposPublicosUsuario = {
  id: true,
  pessoa_id: true,
  email: true,
  role: true,
  status: true,
  pessoa: { select: { nome: true } },
};

class ErroUsuario extends Error {
  constructor(statusCode, mensagem, campo) {
    super(mensagem);
    this.statusCode = statusCode;
    this.campo = campo;
  }
}

function formatarUsuario({ id, pessoa_id, email, role, status, pessoa }) {
  return { id, pessoa_id, nome: pessoa.nome, email, role, status };
}

async function listarUsuarios() {
  const usuarios = await prisma.usuario.findMany({
    select: camposPublicosUsuario,
    orderBy: [{ pessoa: { nome: 'asc' } }, { id: 'asc' }],
  });

  return usuarios.map(formatarUsuario);
}

async function vincularPessoa(dados) {
  if (dados.modo === 'nova') {
    return { create: { nome: dados.pessoa.nome } };
  }

  const pessoa = await prisma.pessoa.findUnique({
    where: { id: dados.pessoa_id },
    select: {
      status_geral: true,
      usuario: { select: { id: true } },
    },
  });

  if (!pessoa) {
    throw new ErroUsuario(404, 'Pessoa não encontrada.', 'pessoa_id');
  }

  if (pessoa.usuario) {
    throw new ErroUsuario(409, 'Esta pessoa já possui um usuário cadastrado.', 'pessoa_id');
  }

  if (pessoa.status_geral !== 'ATIVO') {
    throw new ErroUsuario(400, 'Somente pessoas ativas podem receber uma conta.', 'pessoa_id');
  }

  return { connect: { id: dados.pessoa_id, status_geral: 'ATIVO' } };
}

async function criarUsuario(dados) {
  const pessoa = await vincularPessoa(dados);

  const contaComEmail = await prisma.usuario.findFirst({
    where: { email: { equals: dados.email, mode: 'insensitive' } },
    select: { id: true },
  });

  if (contaComEmail) {
    throw new ErroUsuario(409, 'O e-mail informado já está em uso.', 'email');
  }

  const senhaHash = await argon2.hash(dados.senha, { type: argon2.argon2id });

  try {
    const usuario = await prisma.usuario.create({
      data: {
        email: dados.email,
        role: dados.role,
        senha_hash: senhaHash,
        status: 'ATIVO',
        pessoa,
      },
      select: camposPublicosUsuario,
    });

    return formatarUsuario(usuario);
  } catch (erro) {
    if (erro.code === 'P2002') {
      const campos = Array.isArray(erro.meta?.target) ? erro.meta.target : [erro.meta?.target];
      if (campos.some((campo) => typeof campo === 'string' && campo.includes('pessoa_id'))) {
        throw new ErroUsuario(409, 'Esta pessoa já possui um usuário cadastrado.', 'pessoa_id');
      }
      if (campos.some((campo) => typeof campo === 'string' && campo.includes('email'))) {
        throw new ErroUsuario(409, 'O e-mail informado já está em uso.', 'email');
      }
      throw new ErroUsuario(409, 'A pessoa já possui uma conta ou o e-mail já está em uso.');
    }

    if (dados.modo === 'existente' && ['P2025', 'P2018', 'P2003'].includes(erro.code)) {
      throw new ErroUsuario(409, 'A pessoa informada deixou de estar disponível. Verifique o código.', 'pessoa_id');
    }

    throw erro;
  }
}

async function editarUsuario(id, dados) {
  const existente = await prisma.usuario.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existente) {
    throw new ErroUsuario(404, 'Usuário não encontrado.');
  }

  if (dados.email !== undefined) {
    const contaComEmail = await prisma.usuario.findFirst({
      where: { id: { not: id }, email: { equals: dados.email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (contaComEmail) {
      throw new ErroUsuario(409, 'O e-mail informado já está em uso.', 'email');
    }
  }

  const dadosPessoa = {
    ...(dados.pessoa?.nome !== undefined ? { nome: dados.pessoa.nome } : {}),
    ...(dados.status === 'ATIVO' ? { status_geral: 'ATIVO' } : {}),
  };
  const data = {
    ...(dados.email !== undefined ? { email: dados.email } : {}),
    ...(dados.role !== undefined ? { role: dados.role } : {}),
    ...(dados.status !== undefined ? { status: dados.status } : {}),
    ...(Object.keys(dadosPessoa).length ? { pessoa: { update: dadosPessoa } } : {}),
  };
  if (dados.senha !== undefined) {
    data.senha_hash = await argon2.hash(dados.senha, { type: argon2.argon2id });
  }

  try {
    const usuario = await prisma.usuario.update({
      where: { id },
      data,
      select: camposPublicosUsuario,
    });

    return formatarUsuario(usuario);
  } catch (erro) {
    if (erro.code === 'P2025') {
      throw new ErroUsuario(404, 'Usuário não encontrado.');
    }
    if (erro.code === 'P2002') {
      const campos = Array.isArray(erro.meta?.target) ? erro.meta.target : [erro.meta?.target];
      if (campos.some((campo) => typeof campo === 'string' && campo.includes('email'))) {
        throw new ErroUsuario(409, 'O e-mail informado já está em uso.', 'email');
      }
    }
    throw erro;
  }
}

module.exports = { ErroUsuario, listarUsuarios, criarUsuario, editarUsuario };
