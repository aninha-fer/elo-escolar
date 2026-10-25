const prisma = require('../prismaClient');

async function criarAlunoService(dadosAluno) {
  const { nome, telefone, data_nascimento, nome_responsavel, telefone_responsavel, turno, dias_frequencia, participa_almoco, status, turma_id } = dadosAluno;

  if (!nome || nome.trim() === '') {
    throw new Error('Informe ao menos o nome do aluno.');
  }

  const isRascunho = status === 'RASCUNHO';
  if (!isRascunho) {
    if (!turno) {
      throw new Error('O turno é obrigatório para cadastros ativos.');
    }
    if (!dias_frequencia || !Array.isArray(dias_frequencia) || dias_frequencia.length === 0) {
      throw new Error('Selecione ao menos um dia de frequência.');
    }
  }

  const novoAluno = await prisma.$transaction(async (tx) => {
    const pessoa = await tx.pessoa.create({
      data: {
        nome,
        telefone: telefone || null,
        data_nascimento: data_nascimento ? new Date(data_nascimento) : null,
        status_geral: isRascunho ? 'INATIVO' : 'ATIVO'
      }
    });

    const aluno = await tx.aluno.create({
      data: {
        pessoa_id: pessoa.id,
        nome_responsavel: nome_responsavel || null,
        telefone_responsavel: telefone_responsavel || null,
        turno: turno || null,
        dias_frequencia: dias_frequencia || [],
        participa_almoco: participa_almoco ?? false,
        status
      }
    });

    if (turma_id) {
      if (isRascunho) {
        throw new Error('Alunos em rascunho não podem ser matriculados em turmas.');
      }

      const turma = await tx.turma.findUnique({ where: { id: turma_id } });

      if (!turma) {
        throw new Error('A turma informada não existe.');
      }
      if (turma.tipo !== 'REGULAR') {
        throw new Error('A matrícula inicial só pode ser feita em uma turma REGULAR.');
      }
      if (turma.turno !== turno) {
        throw new Error('O turno da turma regular deve coincidir com o turno do aluno.');
      }

      await tx.matricula_turma.create({
        data: {
          aluno_id: aluno.id,
          turma_id: turma.id,
          data_inicio: new Date(),
          status: 'ATIVO'
        }
      });
    }

    return { ...pessoa, ...aluno };
  });

  return novoAluno;
}

async function listarAlunosService() {
  const alunos = await prisma.aluno.findMany({
    include: {
      pessoa: true,
      matriculas_turmas: {
        where: {
          status: 'ATIVO',
          turma: {
            is: { tipo: 'REGULAR' }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 1,
        select: {
          turma: {
            select: { id: true, nome: true, turno: true }
          }
        }
      }
    },
    orderBy: {
      pessoa: {
        nome: 'asc'
      }
    }
  });

  return alunos.map(aluno => {
    const matriculaRegular = aluno.matriculas_turmas[0];

    return {
      id: aluno.id,
      nome: aluno.pessoa.nome,
      nome_responsavel: aluno.nome_responsavel,
      turno: aluno.turno,
      dias_frequencia: aluno.dias_frequencia,
      status: aluno.status,
      turma_regular: matriculaRegular?.turma ?? null
    };
  });
}

async function obterAlunoService(aluno_id) {
  const aluno = await prisma.aluno.findUnique({
    where: { id: aluno_id },
    include: {
      pessoa: true
    },
  });
  return aluno;
}

async function obterOficinasService(aluno_id) {
  const oficinas = await prisma.matricula_turma.findMany({
    where: {
      aluno_id: aluno_id,
      status: 'ATIVO',
      turma: {
        tipo: 'OFICINA'
      }
    },
    include: {
      turma: {
        include: {
          horarios: true
        }
      }
    }
  });
  return oficinas;
}

async function obterAtendimentosService(aluno_id) {
  const atendimentos = await prisma.atendimento_clinico.findMany({
    where: {
      aluno_id: aluno_id,
      status: 'ATIVO',
    },
  });
  return atendimentos;
}

module.exports = { criarAlunoService, listarAlunosService, obterAlunoService, obterOficinasService, obterAtendimentosService };