const argon2 = require('argon2');
const prisma = require('../prismaClient');

const camposPublicos = {
    id: true,
    email: true,
    role: true,
    pessoa: {
        select: {
            nome: true,
            status_geral: true
        }
    },
};

function identidadePublica(usuario) {
    return {
        id: usuario.id,
        nome: usuario.pessoa.nome,
        email: usuario.email,
        role: usuario.role,
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

    if (!senhaCorreta || usuario?.pessoa.status_geral !== 'ATIVO') {
        return null;
    }

    return usuario && senhaCorreta ? identidadePublica(usuario) : null;
}

async function buscarIdentidadePorId(id) {
    const usuario = await prisma.usuario.findUnique({
        where: { id },
        select: camposPublicos,
    });

    if (usuario?.pessoa.status_geral !== 'ATIVO') {
        return null;
    }

    return usuario ? identidadePublica(usuario) : null;
}

module.exports = { verificarCredenciais, buscarIdentidadePorId };