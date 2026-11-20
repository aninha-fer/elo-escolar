const argon2 = require('argon2');
const prisma = require('../prismaClient');

const camposPublicos = {
    id: true,
    email: true,
    role: true,
    status: true,
    deleted_at: true,
    deve_trocar_senha: true,
    senha_versao: true,
    pessoa: {
        select: {
            nome: true,
            status_geral: true,
            funcionario: { select: { deleted_at: true } },
        }
    },
};

function identidadePublica(usuario) {
    return {
        id: usuario.id,
        nome: usuario.pessoa.nome,
        email: usuario.email,
        role: usuario.role,
        deve_trocar_senha: usuario.deve_trocar_senha,
        senha_versao: usuario.senha_versao,
    };
}

let hashFicticio;

async function verificarCredenciais({ email, senha }) {
    hashFicticio ??= argon2.hash('valor-ficticio-sem-conta', {
        type: argon2.argon2id,
    });

    const usuario = await prisma.usuario.findUnique({
        where: { email },
        select: { ...camposPublicos, senha_hash: true },
    });

    const hash = usuario?.senha_hash ?? (await hashFicticio);
    const senhaCorreta = await argon2.verify(hash, senha);

    if (!senhaCorreta || !usuario?.senha_hash || usuario.deleted_at || usuario.pessoa.funcionario?.deleted_at
        || usuario.status !== 'ATIVO' || usuario.pessoa.status_geral !== 'ATIVO') {
        return null;
    }

    return usuario && senhaCorreta ? identidadePublica(usuario) : null;
}

async function buscarIdentidadePorId(id) {
    const usuario = await prisma.usuario.findUnique({
        where: { id },
        select: camposPublicos,
    });

    if (!usuario || usuario.deleted_at || usuario.pessoa.funcionario?.deleted_at
        || usuario.status !== 'ATIVO' || usuario.pessoa.status_geral !== 'ATIVO') {
        return null;
    }

    return usuario ? identidadePublica(usuario) : null;
}

function removerVersao({ senha_versao, ...usuario }) {
    return usuario;
}

function erroTroca(statusCode, mensagem) {
    return Object.assign(new Error(mensagem), { statusCode });
}

async function trocarSenhaInicial(id, versao, novaSenha) {
    const usuario = await prisma.usuario.findUnique({ where: { id }, select: { ...camposPublicos, senha_hash: true } });
    if (!usuario || usuario.deleted_at || usuario.status !== 'ATIVO' || usuario.pessoa.status_geral !== 'ATIVO'
        || usuario.pessoa.funcionario?.deleted_at || usuario.senha_versao !== versao) {
        throw erroTroca(401, 'Sessão inválida ou expirada.');
    }
    if (!usuario.deve_trocar_senha) throw erroTroca(409, 'A troca inicial de senha já foi concluída.');
    if (await argon2.verify(usuario.senha_hash, novaSenha)) throw erroTroca(400, 'A nova senha deve ser diferente da senha temporária.');
    const hash = await argon2.hash(novaSenha, { type: argon2.argon2id });
    const resultado = await prisma.usuario.updateMany({
        where: { id, senha_versao: versao, deve_trocar_senha: true, deleted_at: null, status: 'ATIVO',
            pessoa: { is: { status_geral: 'ATIVO', OR: [{ funcionario: { is: null } }, { funcionario: { is: { deleted_at: null } } }] } } },
        data: { senha_hash: hash, deve_trocar_senha: false, senha_versao: { increment: 1 } },
    });
    if (!resultado.count) throw erroTroca(401, 'Sessão inválida ou expirada.');
    return { ...identidadePublica(usuario), deve_trocar_senha: false, senha_versao: versao + 1 };
}

module.exports = { verificarCredenciais, buscarIdentidadePorId, removerVersao, trocarSenhaInicial };
