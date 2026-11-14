const argon2 = require('argon2');
const prisma = require('../prismaClient');

const camposPublicosUsuario = {
  id: true,
  pessoa_id: true,
  email: true,
  role: true,
  pessoa: { select: { nome: true } },
};

class ErroUsuario extends Error {
  constructor(statusCode, mensagem, campo) {
    super(mensagem);
    this.statusCode = statusCode;
    this.campo = campo;
  }
}

function formatarUsuario({ id, pessoa_id, email, role, pessoa }) {
  return { id, pessoa_id, nome: pessoa.nome, email, role };
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

module.exports = { ErroUsuario, listarUsuarios, criarUsuario };
