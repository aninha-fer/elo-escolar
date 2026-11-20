const argon2 = require('argon2');
const prisma = require('../prismaClient');
const { paginarIds, formatarPagina } = require('./paginacaoService');

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

async function listarUsuarios(paginacao) {
  const pagina = paginacao ? await paginarIds('usuarios', paginacao) : null;
  const usuarios = await prisma.usuario.findMany({
    where: { deleted_at: null, ...(pagina ? { id: { in: pagina.ids } } : {}) },
    select: camposPublicosUsuario,
    orderBy: [{ pessoa: { nome: 'asc' } }, { id: 'asc' }],
  });

  return formatarPagina(usuarios.map(formatarUsuario), pagina);
}

async function vincularPessoa(dados, tx) {
  if (dados.modo === 'nova') {
    return { create: { nome: dados.pessoa.nome } };
  }

  const funcionario = await tx.funcionario.findUnique({ where: { pessoa_id: dados.pessoa_id }, select: { id: true } });
  if (funcionario) await tx.$queryRaw`SELECT "id" FROM "funcionario" WHERE "id" = ${funcionario.id} FOR UPDATE`;
  const pessoa = await tx.pessoa.findUnique({
    where: { id: dados.pessoa_id },
    select: {
      status_geral: true,
      usuario: { select: { id: true } },
      funcionario: { select: { deleted_at: true } },
    },
  });

  if (!pessoa) {
    throw new ErroUsuario(404, 'Pessoa não encontrada.', 'pessoa_id');
  }

  if (pessoa.funcionario?.deleted_at) {
    throw new ErroUsuario(409, 'Não é possível criar usuário para um funcionário excluído.', 'pessoa_id');
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
  return prisma.$transaction((tx) => criarUsuarioNaTransacao(tx, dados), { isolationLevel: 'ReadCommitted' });
}

async function criarUsuarioNaTransacao(tx, dados) {
  const pessoa = await vincularPessoa(dados, tx);

  const contaComEmail = await tx.usuario.findFirst({
    where: { email: { equals: dados.email, mode: 'insensitive' } },
    select: { id: true },
  });

  if (contaComEmail) {
    throw new ErroUsuario(409, 'O e-mail informado já está em uso.', 'email');
  }

  const senhaHash = await argon2.hash(dados.senha, { type: argon2.argon2id });

  try {
    const usuario = await tx.usuario.create({
      data: {
        email: dados.email,
        role: dados.role,
        senha_hash: senhaHash,
        deve_trocar_senha: true,
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
  return prisma.$transaction((tx) => editarUsuarioNaTransacao(tx, id, dados), { isolationLevel: 'ReadCommitted' });
}

async function obterUsuarioParaAlteracao(tx, id) {
  const referencia = await tx.usuario.findUnique({
    where: { id },
    select: { id: true, pessoa: { select: { funcionario: { select: { id: true } } } } },
  });
  if (!referencia) {
    throw new ErroUsuario(404, 'Usuário não encontrado.');
  }
  if (referencia.pessoa?.funcionario) {
    await tx.$queryRaw`SELECT "id" FROM "funcionario" WHERE "id" = ${referencia.pessoa.funcionario.id} FOR UPDATE`;
  }
  await tx.$queryRaw`SELECT "id" FROM "usuario" WHERE "id" = ${id} FOR UPDATE`;
  const existente = await tx.usuario.findUnique({ where: { id },
    select: { id: true, pessoa_id: true, deleted_at: true, pessoa: { select: { funcionario: { select: { deleted_at: true } } } } } });
  if (!existente || existente.deleted_at) {
    throw new ErroUsuario(404, 'Usuário não encontrado.');
  }
  return existente;
}

async function editarUsuarioNaTransacao(tx, id, dados) {
  const existente = await obterUsuarioParaAlteracao(tx, id);
  if (existente.pessoa?.funcionario?.deleted_at) {
    throw new ErroUsuario(404, 'Usuário não encontrado.');
  }

  if (dados.email !== undefined) {
    const contaComEmail = await tx.usuario.findFirst({
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
    data.deve_trocar_senha = true;
    data.senha_versao = { increment: 1 };
  }

  try {
    const usuario = await tx.usuario.update({
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

async function excluirUsuario(id) {
  return prisma.$transaction(async (tx) => {
    const usuario = await obterUsuarioParaAlteracao(tx, id);
    await tx.$queryRaw`SELECT "id" FROM "pessoa" WHERE "id" = ${usuario.pessoa_id} FOR UPDATE`;
    await tx.usuario.update({
      where: { id },
      data: { deleted_at: new Date(), email: null, senha_hash: null, status: 'INATIVO' },
      select: { id: true },
    });
    await tx.pessoa.updateMany({
      where: {
        id: usuario.pessoa_id,
        AND: [
          { OR: [{ funcionario: { is: null } }, { funcionario: { is: { deleted_at: { not: null } } } }] },
          { OR: [{ aluno: { is: null } }, { aluno: { is: { deleted_at: { not: null } } } }] },
        ],
        alunos_responsavel: { none: {} },
      },
      data: { status_geral: 'INATIVO' },
    });
  }, { isolationLevel: 'ReadCommitted' });
}

module.exports = { ErroUsuario, listarUsuarios, criarUsuario, editarUsuario, excluirUsuario };
