const prisma = require('../prismaClient');

async function criarAluno(req, res) {
  try {
    const { nome, telefone, data_nascimento, nome_responsavel, telefone_responsavel, turno, dias_frequencia } = req.body;

    if (!nome || !turno || !dias_frequencia) {
      return res.status(400).json({ erro: 'Nome, turno e dias de frequência são obrigatórios.' });
    }

    const novoAluno = await prisma.$transaction(async (tx) => {
      const pessoa = await tx.pessoa.create({
        data: {
          nome,
          telefone,
          data_nascimento: data_nascimento ? new Date(data_nascimento) : null,
          status_geral: 'ATIVO'
        }
      });

      const aluno = await tx.aluno.create({
        data: {
          pessoa_id: pessoa.id,
          nome_responsavel,
          telefone_responsavel,
          turno,
          dias_frequencia,
          status: 'RASCUNHO'
        }
      });

      return { ...pessoa, ...aluno };
    });

    return res.status(201).json(novoAluno);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao cadastrar aluno.' });
  }
}

module.exports = { criarAluno };