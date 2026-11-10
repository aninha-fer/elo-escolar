require('dotenv').config({ quiet: true });

const readline = require('node:readline');
const { Writable } = require('node:stream');
const { parseArgs } = require('node:util');
const argon2 = require('argon2');
const { z } = require('zod');
const prisma = require('../src/prismaClient');

class ErroComando extends Error {}

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
const senhaSchema = z.string().min(8).max(100);

function lerArgumentos() {
  let argumentos;

  try {
    argumentos = parseArgs({
      options: {
        'pessoa-id': { type: 'string' },
        email: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch {
    throw new ErroComando('Use --pessoa-id <id> e --email <endereço>.');
  }

  const idInformado = argumentos['pessoa-id'] ?? '';
  const pessoaId = Number(idInformado);

  if (!/^[1-9][0-9]*$/.test(idInformado) || pessoaId > 2147483647) {
    throw new ErroComando('Informe um ID de pessoa válido em --pessoa-id.');
  }

  const email = emailSchema.safeParse(argumentos.email);

  if (!email.success) {
    throw new ErroComando('Informe um endereço de e-mail válido em --email.');
  }

  return { pessoaId, email: email.data };
}

function lerSenhaOculta(pergunta) {
  if (!process.stdin.isTTY) {
    throw new ErroComando(
      'Execute o comando em um terminal interativo para digitar a senha.'
    );
  }

  return new Promise((resolve, reject) => {
    // O readline edita a linha, mas sua saída é descartada para ocultar a senha.
    const saidaOculta = new Writable({
      write(_dados, _codificacao, callback) {
        callback();
      },
    });

    const entrada = readline.createInterface({
      input: process.stdin,
      output: saidaOculta,
      terminal: true,
      historySize: 0,
    });

    entrada.once('SIGINT', () => entrada.close());

    entrada.once('close', () => {
      process.stderr.write('\n');
      reject(new ErroComando('Operação cancelada.'));
    });

    process.stderr.write(pergunta);

    entrada.question('', (senha) => {
      resolve(senha);
      entrada.close();
    });
  });
}

async function criarAdministrador() {
  const { pessoaId, email } = lerArgumentos();

  if (!process.env.DATABASE_URL) {
    throw new ErroComando('Configure DATABASE_URL no ambiente do backend.');
  }

  const pessoa = await prisma.pessoa.findUnique({
    where: { id: pessoaId },
    select: { id: true },
  });

  if (!pessoa) {
    throw new ErroComando('A pessoa informada não existe no banco configurado.');
  }

  const senha = await lerSenhaOculta('Senha inicial: ');

  if (!senhaSchema.safeParse(senha).success) {
    throw new ErroComando('A senha deve ter entre 8 e 100 caracteres.');
  }

  const confirmacao = await lerSenhaOculta('Confirme a senha inicial: ');

  if (senha !== confirmacao) {
    throw new ErroComando('As senhas digitadas são diferentes.');
  }

  const senhaHash = await argon2.hash(senha, { type: argon2.argon2id });

  const usuario = await prisma.usuario.create({
    data: {
      pessoa_id: pessoaId,
      email,
      senha_hash: senhaHash,
      role: 'admin',
    },
    select: { id: true, email: true },
  });

  console.log(JSON.stringify(usuario));
}

async function main() {
  try {
    await criarAdministrador();
  } catch (erro) {
    process.exitCode = 1;

    if (erro instanceof ErroComando) {
      console.error(erro.message);
    } else if (erro?.code === 'P2002') {
      console.error('A pessoa já tem uma conta ou o e-mail já está em uso.');
    } else if (erro?.code === 'P2003') {
      console.error('A pessoa informada deixou de estar disponível para o vínculo.');
    } else {
      console.error(
        'Falha ao criar o administrador. Verifique a conexão e as migrations do banco.'
      );
    }
  } finally {
    try {
      await prisma.$disconnect();
    } catch {
      process.exitCode = 1;
      console.error('Falha ao encerrar a conexão com o banco.');
    }
  }
}

void main();