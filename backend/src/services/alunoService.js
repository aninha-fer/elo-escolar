const prisma = require('../prismaClient');
const { matricularTurmaRegularNaTransacao } = require('./matriculaService');

const selectResponsavel = {
  id: true, pessoa_id: true, parentesco: true,
  pessoa: { select: { nome: true, telefone: true } }
};
const selectDadosMedicos = {
  restricao_alimentar: true, autorizado_atividade_fisica: true, usa_medicamento: true,
  medicamentos_descricao: true, autorizacao_analgesico: true
};

function formatarResponsaveis(responsaveis = [], incluirTelefone = true) {
  return responsaveis.map((vinculo) => ({
    id: vinculo.id, pessoa_id: vinculo.pessoa_id, nome: vinculo.pessoa.nome, parentesco: vinculo.parentesco,
    ...(incluirTelefone ? { telefone: vinculo.pessoa.telefone } : {})
  }));
}

async function criarAlunoService(dadosAluno) {
  const { nome, telefone, data_nascimento, responsaveis = [], participa_procan = false, observacoes,
    dados_medicos, turno, dias_frequencia, participa_almoco, status, turma_id } = dadosAluno;

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
        status_geral: status === 'ATIVO' ? 'ATIVO' : 'INATIVO'
      }
    });

    const aluno = await tx.aluno.create({
      data: {
        pessoa_id: pessoa.id,
        participa_procan,
        observacoes: observacoes || null,
        turno: turno || null,
        dias_frequencia: dias_frequencia || [],
        participa_almoco: participa_almoco ?? false,
        status
      }
    });

    const vinculosResponsaveis = [];
    for (const responsavel of responsaveis) {
      const pessoaResponsavel = await tx.pessoa.create({
        data: { nome: responsavel.nome, telefone: responsavel.telefone || null, status_geral: 'ATIVO' }
      });
      const vinculo = await tx.aluno_responsavel.create({
        data: { aluno_id: aluno.id, pessoa_id: pessoaResponsavel.id, parentesco: responsavel.parentesco || null }
      });
      vinculosResponsaveis.push({ ...vinculo, pessoa: pessoaResponsavel });
    }
    let dadosMedicos = null;
    if (dados_medicos && Object.values(dados_medicos).some((valor) => valor != null)) {
      dadosMedicos = await tx.aluno_dados_medicos.create({
        data: { ...dados_medicos, aluno_id: aluno.id }, select: selectDadosMedicos
      });
    }

    if (turma_id) {
      await matricularTurmaRegularNaTransacao(tx, { aluno_id: aluno.id, turma_id });
    }

    return { ...pessoa, ...aluno, responsaveis: formatarResponsaveis(vinculosResponsaveis), dados_medicos: dadosMedicos };
  }, { isolationLevel: 'ReadCommitted' });

  return novoAluno;
}

async function listarAlunosService() {
  const alunos = await prisma.aluno.findMany({
    include: {
      pessoa: true,
      responsaveis: {
        orderBy: { id: 'asc' },
        select: { ...selectResponsavel, pessoa: { select: { nome: true } } }
      },
      matriculas_turmas: {
        where: {
          OR: [{ status: 'ATIVO' }, { status: 'PROVISORIO', aluno: { status: 'RASCUNHO' } }],
          turma: {
            is: { tipo: 'REGULAR' }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 1,
        select: {
          id: true, status: true,
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
      responsaveis: formatarResponsaveis(aluno.responsaveis, false),
      participa_procan: aluno.participa_procan,
      turno: aluno.turno,
      dias_frequencia: aluno.dias_frequencia,
      status: aluno.status,
      turma_regular: matriculaRegular?.turma ?? null,
      matricula_regular: matriculaRegular ? { id: matriculaRegular.id, status: matriculaRegular.status } : null
    };
  });
}

async function obterAlunoService(aluno_id) {
  const aluno = await prisma.aluno.findUnique({
    where: { id: aluno_id },
    include: {
      pessoa: true,
      responsaveis: { orderBy: { id: 'asc' }, select: selectResponsavel },
      dados_medicos: { select: selectDadosMedicos },
      matriculas_turmas: {
        where: { OR: [{ status: 'ATIVO' }, { status: 'PROVISORIO', aluno: { status: 'RASCUNHO' } }], turma: { tipo: 'REGULAR', status: 'ATIVO' } },
        orderBy: { created_at: 'desc' },
        take: 1,
        select: { id: true, status: true, turma: { select: { id: true, nome: true, turno: true } } }
      }
    },
  });
  if (!aluno) return null;
  const { matriculas_turmas, responsaveis, ...dados } = aluno;
  const regular = matriculas_turmas[0];
  return { ...dados, responsaveis: formatarResponsaveis(responsaveis), dados_medicos: aluno.dados_medicos ?? null,
    turma_regular: regular?.turma ?? null,
    matricula_regular: regular ? { id: regular.id, status: regular.status } : null };
}

async function obterOficinasService(aluno_id) {
  const oficinas = await prisma.matricula_turma.findMany({
    where: {
      aluno_id: aluno_id,
      OR: [{ status: 'ATIVO' }, { status: 'PROVISORIO', aluno: { status: 'RASCUNHO' } }],
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
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  const hoje = new Date(`${valor('year')}-${valor('month')}-${valor('day')}T00:00:00.000Z`);

  const atendimentos = await prisma.atendimento_clinico.findMany({
    where: {
      aluno_id: aluno_id,
      AND: [{ OR: [{ status: 'ATIVO' }, { status: 'PROVISORIO', aluno: { status: 'RASCUNHO' } }] }],
      OR: [
        { tipo_recorrencia: 'EVENTUAL', data_inicio: { gte: hoje } },
        {
          tipo_recorrencia: { in: ['SEMANAL', 'MENSAL'] },
          OR: [{ data_termino: { gte: hoje } }, { data_termino: null }]
        }
      ]
    },
    include: {
      profissional: { select: { pessoa: { select: { nome: true } } } }
    },
    orderBy: [{ data_inicio: 'asc' }, { hora_inicio: 'asc' }, { id: 'asc' }]
  });
  return atendimentos;
}

module.exports = { criarAlunoService, listarAlunosService, obterAlunoService, obterOficinasService, obterAtendimentosService };
