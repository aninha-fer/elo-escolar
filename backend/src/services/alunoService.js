const prisma = require('../prismaClient');
const { paginarIds, formatarPagina } = require('./paginacaoService');
const { matricularTurmaRegularNaTransacao } = require('./matriculaService');
const { editarAlunoDTO, alterarStatusAlunoDTO } = require('../dtos/alunoDTO');
const { agoraInstituicao, inicioOcorrencia, dataEncerramento, fimMatricula, DIA_MS } = require('./encerramentoAtividade');
const { bloquearProfissionalAtivo } = require('./profissionalService');

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

async function listarAlunosService(paginacao) {
  const pagina = paginacao ? await paginarIds('alunos', paginacao) : null;
  const alunos = await prisma.aluno.findMany({
    where: { deleted_at: null, ...(pagina ? { id: { in: pagina.ids } } : {}) },
    include: {
      pessoa: true,
      responsaveis: {
        orderBy: { id: 'asc' },
        select: { ...selectResponsavel, pessoa: { select: { nome: true } } }
      },
      matriculas_turmas: {
        where: {
          OR: [{ status: 'ATIVO' }, { status: 'PROVISORIO', data_fim: null, aluno: { status: 'RASCUNHO' } }],
          turma: {
            is: { tipo: 'REGULAR', deleted_at: null }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 1,
        select: {
          id: true, status: true,
          turma: {
            select: { id: true, nome: true, turno: true, status: true }
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

  const itens = alunos.map(aluno => {
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
  return formatarPagina(itens, pagina);
}

async function obterAlunoService(aluno_id) {
  const aluno = await prisma.aluno.findUnique({
    where: { id: aluno_id },
    include: {
      pessoa: true,
      responsaveis: { orderBy: { id: 'asc' }, select: selectResponsavel },
      dados_medicos: { select: selectDadosMedicos },
      matriculas_turmas: {
        where: { OR: [{ status: 'ATIVO' }, { status: 'PROVISORIO', data_fim: null, aluno: { status: 'RASCUNHO' } }], turma: { tipo: 'REGULAR', deleted_at: null } },
        orderBy: { created_at: 'desc' },
        take: 1,
        select: { id: true, status: true, turma: { select: { id: true, nome: true, turno: true, status: true } } }
      }
    },
  });
  if (!aluno || aluno.deleted_at) return null;
  const { matriculas_turmas, responsaveis, ...dados } = aluno;
  const regular = matriculas_turmas[0];
  return { ...dados, responsaveis: formatarResponsaveis(responsaveis), dados_medicos: aluno.dados_medicos ?? null,
    turma_regular: regular?.turma ?? null,
    matricula_regular: regular ? { id: regular.id, status: regular.status } : null };
}

async function obterOficinasService(aluno_id, paginacao) {
  const aluno = await prisma.aluno.findUnique({ where: { id: aluno_id }, select: { id: true, deleted_at: true } });
  if (!aluno || aluno.deleted_at) throw Object.assign(new Error('Aluno não encontrado.'), { statusCode: 404 });
  const pagina = paginacao ? await paginarIds('oficinas_aluno', paginacao, { alunoId: aluno_id }) : null;
  const oficinas = await prisma.matricula_turma.findMany({
    where: {
      aluno_id: aluno_id,
      ...(pagina ? { id: { in: pagina.ids } } : {}),
      OR: [{ status: 'ATIVO' }, { status: 'PROVISORIO', data_fim: null, aluno: { status: 'RASCUNHO' } }],
      turma: {
        tipo: 'OFICINA', deleted_at: null
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
  return formatarPagina(oficinas, pagina);
}

async function obterAtendimentosService(aluno_id, paginacao) {
  const aluno = await prisma.aluno.findUnique({ where: { id: aluno_id }, select: { id: true, deleted_at: true } });
  if (!aluno || aluno.deleted_at) throw Object.assign(new Error('Aluno não encontrado.'), { statusCode: 404 });
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  const hoje = new Date(`${valor('year')}-${valor('month')}-${valor('day')}T00:00:00.000Z`);

  const pagina = paginacao ? await paginarIds('atendimentos_aluno', paginacao, { alunoId: aluno_id }) : null;
  const atendimentos = await prisma.atendimento_clinico.findMany({
    where: {
      aluno_id: aluno_id,
      ...(pagina ? { id: { in: pagina.ids } } : {}),
      AND: [{ OR: [{ status: 'ATIVO' }, { status: 'PROVISORIO', aluno: { status: 'RASCUNHO' } }] }],
      data_cancelamento: null,
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
  return formatarPagina(atendimentos, pagina);
}

function conflitoEdicao(mensagem, detalhes) {
  return Object.assign(new Error(mensagem), { isConflict: true, detalhes });
}

async function lerPlanejamento(tx, aluno_id) {
  const [matriculas, atendimentos] = await Promise.all([
    tx.matricula_turma.findMany({ where: { aluno_id, OR: [
      { status: 'ATIVO' }, { status: 'PROVISORIO', data_fim: null }
    ] }, include: { turma: { include: { horarios: true } } } }),
    tx.atendimento_clinico.findMany({ where: { aluno_id, status: { in: ['ATIVO', 'PROVISORIO'] }, data_cancelamento: null },
      include: { sessoes: { where: { status: { in: ['ATIVO', 'PROVISORIO'] }, data_cancelamento: null } } } })
  ]);
  return { matriculas, atendimentos };
}

function intervalosOficina(matricula, inicio, fim) {
  const intervalos = [];
  const dia = new Date(inicio - DIA_MS);
  dia.setUTCHours(0, 0, 0, 0);
  for (; dia.getTime() < fim; dia.setUTCDate(dia.getUTCDate() + 1)) {
    if ((matricula.data_inicio && dia < matricula.data_inicio) || (matricula.data_fim && dia > matricula.data_fim)) continue;
    for (const horario of matricula.turma.horarios) {
      if (horario.dia_semana !== (dia.getUTCDay() || 7)) continue;
      const de = inicioOcorrencia(dia, horario.hora_inicio);
      let ate = inicioOcorrencia(dia, horario.hora_fim);
      if (ate < de) ate += DIA_MS;
      if (de < fim && ate > inicio) intervalos.push({ inicio: de, fim: ate });
    }
  }
  return intervalos;
}

function sessoesFuturas(atendimento, agora) {
  return atendimento.sessoes.filter((s) => !s.data_cancelamento && s.status !== 'INATIVO' && inicioOcorrencia(s.data_sessao, s.hora_inicio) + s.duracao_minutos * 60000 > agora.getTime());
}

function diasSessao(sessao) {
  const inicio = inicioOcorrencia(sessao.data_sessao, sessao.hora_inicio);
  const fim = inicio + sessao.duracao_minutos * 60000;
  const dias = new Set();
  const data = new Date(inicio);
  data.setUTCHours(0, 0, 0, 0);
  for (; data.getTime() < fim; data.setUTCDate(data.getUTCDate() + 1)) dias.add(data.getUTCDay() || 7);
  return [...dias];
}

async function validarAtivacao(tx, aluno, planejamento, agora) {
  const conflitos = [];
  const turmas = planejamento.matriculas;
  const oficinas = turmas.filter((m) => m.turma.tipo === 'OFICINA');
  const regulares = turmas.filter((m) => m.turma.tipo === 'REGULAR');
  if (regulares.length > 1) conflitos.push({ mensagem: 'O aluno possui mais de uma turma regular vigente.' });
  for (const m of turmas) {
    const turma = m.turma;
    if (turma.deleted_at || turma.status !== 'ATIVO' || turma.turno !== aluno.turno) conflitos.push({ turma_id: turma.id, mensagem: `${turma.nome}: turma inativa, excluída ou período incompatível.` });
    const dias = turma.horarios.map((h) => h.dia_semana);
    if (turma.tipo === 'REGULAR' ? aluno.dias_frequencia.some((d) => !dias.includes(d)) : dias.some((d) => !aluno.dias_frequencia.includes(d))) {
      conflitos.push({ turma_id: turma.id, mensagem: `${turma.nome}: dias incompatíveis com a frequência do aluno.` });
    }
    if (m.status === 'PROVISORIO' && turma.capacidade_maxima != null) {
      const ocupacao = await tx.matricula_turma.count({ where: { turma_id: turma.id, status: 'ATIVO' } });
      if (ocupacao >= turma.capacidade_maxima) conflitos.push({ turma_id: turma.id, mensagem: `${turma.nome}: sem vagas disponíveis.` });
    }
    if (turmas.some((outra) => outra.id !== m.id && outra.turma_id === m.turma_id)) conflitos.push({ turma_id: turma.id, mensagem: `${turma.nome}: matrícula duplicada.` });
  }
  for (let i = 0; i < oficinas.length; i++) for (const outra of oficinas.slice(i + 1)) {
    const primeira = oficinas[i];
    const inicio = Math.max(agora.getTime(), primeira.data_inicio?.getTime() ?? 0, outra.data_inicio?.getTime() ?? 0);
    const fim = Math.min(inicio + 15 * DIA_MS, primeira.data_fim ? primeira.data_fim.getTime() + DIA_MS : Infinity,
      outra.data_fim ? outra.data_fim.getTime() + DIA_MS : Infinity);
    const a = intervalosOficina(primeira, inicio, fim), b = intervalosOficina(outra, inicio, fim);
    if (a.some((x) => b.some((y) => x.inicio < y.fim && x.fim > y.inicio))) conflitos.push({ mensagem: `Conflito entre as oficinas ${primeira.turma.nome} e ${outra.turma.nome}.` });
  }
  const sessoes = planejamento.atendimentos.flatMap((atendimento) => sessoesFuturas(atendimento, agora).map((sessao) => ({
    ...sessao, atendimento, inicio: inicioOcorrencia(sessao.data_sessao, sessao.hora_inicio),
    fim: inicioOcorrencia(sessao.data_sessao, sessao.hora_inicio) + sessao.duracao_minutos * 60000
  }))).sort((a, b) => a.inicio - b.inicio);
  for (let i = 0; i < sessoes.length; i++) {
    const s = sessoes[i];
    if (diasSessao(s).some((d) => !aluno.dias_frequencia.includes(d))) conflitos.push({ atendimento_id: s.atendimento.id, mensagem: `${s.atendimento.modalidade}: sessão fora dos dias de frequência.` });
    for (const oficina of oficinas) if (intervalosOficina(oficina, s.inicio, s.fim).length) {
      conflitos.push({ atendimento_id: s.atendimento.id, turma_id: oficina.turma_id, mensagem: `Conflito entre ${s.atendimento.modalidade} e ${oficina.turma.nome}.` });
    }
    for (const outra of sessoes.slice(i + 1)) {
      if (outra.inicio >= s.fim) break;
      conflitos.push({ atendimento_id: s.atendimento.id, mensagem: `Conflito entre ${s.atendimento.modalidade} e ${outra.atendimento.modalidade}.` });
    }
  }
  if (conflitos.length) throw conflitoEdicao('Não foi possível ativar o aluno. Revise os conflitos do planejamento.', conflitos);
}

async function editarAlunoService(id, entrada) {
  const dados = editarAlunoDTO.parse(entrada);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "aluno" WHERE "id" = ${id} FOR UPDATE`;
    const atual = await tx.aluno.findUnique({ where: { id }, include: { responsaveis: true } });
    if (!atual || atual.deleted_at) throw Object.assign(new Error('Aluno não encontrado.'), { statusCode: 404 });
    if (dados.status !== undefined && atual.status !== 'RASCUNHO') {
      throw Object.assign(new Error('O status só pode ser editado para alunos em rascunho.'), { statusCode: 400 });
    }
    if (atual.status === 'INATIVO' && dados.turma_id) {
      throw Object.assign(new Error('Não é possível vincular uma turma regular a um aluno inativo.'), { statusCode: 409 });
    }
    const novo = { ...atual, ...dados };
    const mudouTurno = novo.turno !== atual.turno;
    let planejamento = await lerPlanejamento(tx, id);
    // A mesma ordem de bloqueio é usada pelas matrículas e pela edição de turmas.
    const idsTurmas = [...new Set([...planejamento.matriculas.map((m) => m.turma_id), ...(dados.turma_id ? [dados.turma_id] : [])])].sort((a, b) => a - b);
    for (const turma_id of idsTurmas) await tx.$queryRaw`SELECT "id" FROM "turma" WHERE "id" = ${turma_id} FOR UPDATE`;
    planejamento = await lerPlanejamento(tx, id);
    const agora = agoraInstituicao();
    const ativando = atual.status === 'RASCUNHO' && dados.status === 'ATIVO';
    if (ativando) {
      const profissionais = [...new Set([
        ...planejamento.matriculas.map((m) => m.turma.profissional_id),
        ...planejamento.atendimentos.flatMap((a) => a.sessoes.filter((s) => inicioOcorrencia(s.data_sessao, s.hora_inicio) >= agora.getTime())
          .flatMap((s) => [a.profissional_id, s.profissional_id])),
      ].filter(Number.isInteger))].sort((a, b) => a - b);
      for (const profissionalId of profissionais) await bloquearProfissionalAtivo(tx, profissionalId);
    }
    if (mudouTurno && (planejamento.matriculas.length || planejamento.atendimentos.length)) {
      const assinatura = { matriculas: planejamento.matriculas.map((m) => m.id).sort((a,b) => a-b), atendimentos: planejamento.atendimentos.map((a) => a.id).sort((a,b) => a-b) };
      const recebido = dados.confirmar_cancelamentos;
      if (!recebido || JSON.stringify(assinatura) !== JSON.stringify({ matriculas: [...recebido.matriculas].sort((a,b) => a-b), atendimentos: [...recebido.atendimentos].sort((a,b) => a-b) })) {
        throw Object.assign(new Error('A mudança de período encerrará as matrículas e os atendimentos vigentes.'), {
          statusCode: 409, confirmacao: assinatura,
          detalhes: [...planejamento.matriculas.map((m) => ({ mensagem: m.turma.nome })), ...planejamento.atendimentos.map((a) => ({ mensagem: a.modalidade }))]
        });
      }
    }
    const removidos = atual.dias_frequencia.filter((dia) => !novo.dias_frequencia.includes(dia));
    if (!mudouTurno && removidos.length) {
      const conflitos = [
        ...planejamento.matriculas.filter((m) => m.turma.tipo === 'OFICINA' && m.turma.horarios.some((h) => removidos.includes(h.dia_semana)))
          .map((m) => ({ turma_id: m.turma_id, mensagem: `${m.turma.nome}: oficina em dia removido da frequência.` })),
        ...planejamento.atendimentos.filter((a) => sessoesFuturas(a, agora).some((s) =>
          (!ativando || a.status !== 'PROVISORIO' || inicioOcorrencia(s.data_sessao, s.hora_inicio) >= agora.getTime())
          && diasSessao(s).some((d) => removidos.includes(d))))
          .map((a) => ({ atendimento_id: a.id, mensagem: `${a.modalidade}: atendimento em dia removido da frequência.` }))
      ];
      if (conflitos.length) throw conflitoEdicao('Cancele manualmente as atividades abaixo antes de reduzir a frequência:', conflitos);
    }
    const regular = planejamento.matriculas.find((m) => m.turma.tipo === 'REGULAR');
    const trocarRegular = dados.turma_id !== undefined && dados.turma_id !== (regular?.turma_id ?? null);
    const encerrar = mudouTurno ? planejamento.matriculas : trocarRegular && regular ? [regular] : [];
    let dataInicioRegular;
    for (const m of encerrar) {
      const dataFim = fimMatricula(m, agora);
      if (m.id === regular?.id && atual.status === 'ATIVO' && m.status === 'ATIVO') {
        const hoje = new Date(agora); hoje.setUTCHours(0, 0, 0, 0);
        // A sucessora não ocupa o dia preservado nem antecipa uma matrícula ainda futura.
        dataInicioRegular = new Date(Math.max(hoje.getTime(), dataFim.getTime() + DIA_MS, m.data_inicio?.getTime() ?? 0));
      }
      await tx.matricula_turma.update({ where: { id: m.id }, data: {
        data_fim: dataFim, ...(m.status === 'ATIVO' ? { status: 'INATIVO' } : {})
      } });
    }
    if (mudouTurno) for (const a of planejamento.atendimentos) {
      const fim = dataEncerramento(a.sessoes.map((s) => ({ data: s.data_sessao, hora: s.hora_inicio })), agora);
      await tx.atendimento_clinico.update({ where: { id: a.id }, data: {
        data_cancelamento: fim,
        ...(a.status === 'ATIVO' ? { status: 'INATIVO', ...(a.tipo_recorrencia !== 'EVENTUAL' ? { data_termino: a.data_termino && a.data_termino < fim ? a.data_termino : fim } : {}) } : {})
      } });
      const futuras = a.sessoes.filter((s) => !s.data_cancelamento && s.status !== 'INATIVO' && inicioOcorrencia(s.data_sessao, s.hora_inicio) > agora.getTime()).map((s) => s.id);
      const hoje = new Date(agora); hoje.setUTCHours(0, 0, 0, 0);
      await tx.atendimento_sessao.updateMany({ where: { id: { in: futuras }, data_cancelamento: null },
        data: { data_cancelamento: hoje, ...(a.status === 'ATIVO' ? { status: 'INATIVO' } : {}) } });
    }
    const camposPessoa = ['nome', 'telefone', 'data_nascimento'];
    const pessoa = Object.fromEntries(camposPessoa.filter((campo) => dados[campo] !== undefined).map((campo) => [campo,
      campo === 'data_nascimento' && dados[campo] ? new Date(`${dados[campo]}T00:00:00.000Z`) : dados[campo]]));
    if (dados.status === 'ATIVO') pessoa.status_geral = 'ATIVO';
    if (Object.keys(pessoa).length) await tx.pessoa.update({ where: { id: atual.pessoa_id }, data: pessoa });
    const camposAluno = ['turno', 'dias_frequencia', 'participa_almoco', 'participa_procan', 'observacoes'];
    await tx.aluno.update({ where: { id }, data: Object.fromEntries(camposAluno.filter((c) => dados[c] !== undefined).map((c) => [c, dados[c]])) });
    if (dados.responsaveis !== undefined) {
      const ids = dados.responsaveis.filter((r) => r.id).map((r) => r.id);
      if (new Set(ids).size !== ids.length || ids.some((r) => !atual.responsaveis.some((v) => v.id === r))) throw Object.assign(new Error('Responsável inválido para este aluno.'), { statusCode: 400 });
      await tx.aluno_responsavel.deleteMany({ where: { aluno_id: id, id: { notIn: ids } } });
      for (const r of dados.responsaveis) {
        const vinculo = atual.responsaveis.find((v) => v.id === r.id);
        const data = { nome: r.nome, telefone: r.telefone ?? null };
        if (vinculo) {
          await tx.pessoa.update({ where: { id: vinculo.pessoa_id }, data });
          await tx.aluno_responsavel.update({ where: { id: vinculo.id }, data: { parentesco: r.parentesco ?? null } });
        } else {
          const p = await tx.pessoa.create({ data: { ...data, status_geral: 'ATIVO' } });
          await tx.aluno_responsavel.create({ data: { aluno_id: id, pessoa_id: p.id, parentesco: r.parentesco ?? null } });
        }
      }
    }
    if (dados.dados_medicos !== undefined) {
      if (dados.dados_medicos === null) await tx.aluno_dados_medicos.deleteMany({ where: { aluno_id: id } });
      else await tx.aluno_dados_medicos.upsert({ where: { aluno_id: id }, create: { aluno_id: id, ...dados.dados_medicos }, update: dados.dados_medicos });
    }
    if (dados.turma_id && (mudouTurno || trocarRegular)) await matricularTurmaRegularNaTransacao(tx, { aluno_id: id, turma_id: dados.turma_id }, { dataInicio: dataInicioRegular });
    if (ativando) {
      const vigente = await lerPlanejamento(tx, id);
      const dataInicio = new Date(agora);
      dataInicio.setUTCHours(0, 0, 0, 0);
      // Validação e promoção usam o mesmo recorte; sessões já iniciadas continuam como planejamento.
      const planejamentoEfetivo = {
        matriculas: vigente.matriculas.map((m) => m.status === 'PROVISORIO' ? { ...m, data_inicio: dataInicio } : m),
        atendimentos: vigente.atendimentos.map((a) => a.status === 'PROVISORIO' ? {
          ...a, sessoes: a.sessoes.filter((s) => !s.data_cancelamento && (s.status === 'ATIVO' || (s.status === 'PROVISORIO' && inicioOcorrencia(s.data_sessao, s.hora_inicio) >= agora.getTime())))
        } : a)
      };
      await validarAtivacao(tx, novo, planejamentoEfetivo, agora);
      await tx.aluno.update({ where: { id }, data: { status: 'ATIVO' } });
      await tx.matricula_turma.updateMany({ where: { aluno_id: id, status: 'PROVISORIO', data_fim: null }, data: { status: 'ATIVO', data_inicio: dataInicio } });
      const atendimentos = planejamentoEfetivo.atendimentos.filter((a) => a.status === 'PROVISORIO' && a.sessoes.some((s) => s.status === 'PROVISORIO'));
      const ids = atendimentos.map((a) => a.id);
      const sessoes = atendimentos.flatMap((a) => a.sessoes.filter((s) => s.status === 'PROVISORIO').map((s) => s.id));
      await tx.atendimento_clinico.updateMany({ where: { id: { in: ids }, status: 'PROVISORIO', data_cancelamento: null }, data: { status: 'ATIVO' } });
      await tx.atendimento_sessao.updateMany({ where: { id: { in: sessoes }, status: 'PROVISORIO', data_cancelamento: null }, data: { status: 'ATIVO' } });
    }
    return { id };
  }, { isolationLevel: 'ReadCommitted' });
}

async function encerrarVinculosAlunoNaTransacao(tx, aluno) {
  const id = aluno.id;
  const agora = agoraInstituicao();
  const hoje = new Date(agora); hoje.setUTCHours(0, 0, 0, 0);
  let planejamento = await lerPlanejamento(tx, id);
  const lerEncerradasSemFim = () => tx.matricula_turma.findMany({
    where: { aluno_id: id, status: 'INATIVO', data_fim: null }, include: { turma: { include: { horarios: true } } },
  });
  planejamento.matriculas.push(...await lerEncerradasSemFim());
  const turmas = [...new Set(planejamento.matriculas.map((m) => m.turma_id))].sort((a, b) => a - b);
  for (const turmaId of turmas) await tx.$queryRaw`SELECT "id" FROM "turma" WHERE "id" = ${turmaId} FOR UPDATE`;
  planejamento = await lerPlanejamento(tx, id);
  planejamento.matriculas.push(...await lerEncerradasSemFim());
  const rascunho = aluno.status === 'RASCUNHO';
  for (const matricula of planejamento.matriculas) {
    await tx.matricula_turma.update({ where: { id: matricula.id }, data: {
      data_fim: fimMatricula(matricula, agora),
      ...(rascunho && matricula.status === 'PROVISORIO' ? {} : { status: 'INATIVO' }),
    } });
  }
  for (const atendimento of planejamento.atendimentos) {
    await tx.atendimento_clinico.update({ where: { id: atendimento.id }, data: {
      data_cancelamento: hoje,
      ...(rascunho && atendimento.status === 'PROVISORIO' ? {} : { status: 'INATIVO' }),
    } });
  }
  const sessoes = await tx.atendimento_sessao.findMany({ where: {
    atendimento_clinico: { aluno_id: id }, status: { in: ['ATIVO', 'PROVISORIO'] }, data_cancelamento: null,
  } });
  const futuras = sessoes.filter((s) => inicioOcorrencia(s.data_sessao, s.hora_inicio) > agora.getTime());
  for (const statusSessao of ['ATIVO', 'PROVISORIO']) {
    const ids = futuras.filter((s) => s.status === statusSessao).map((s) => s.id);
    if (ids.length) await tx.atendimento_sessao.updateMany({
      where: { id: { in: ids }, data_cancelamento: null },
      data: { data_cancelamento: hoje, ...(rascunho && statusSessao === 'PROVISORIO' ? {} : { status: 'INATIVO' }) },
    });
  }
}

async function alterarStatusAlunoService(id, entrada) {
  const { status } = alterarStatusAlunoDTO.parse(entrada);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "aluno" WHERE "id" = ${id} FOR UPDATE`;
    const aluno = await tx.aluno.findUnique({ where: { id } });
    if (!aluno || aluno.deleted_at) throw Object.assign(new Error('Aluno não encontrado.'), { statusCode: 404 });
    if (status === 'ATIVO' && aluno.status === 'RASCUNHO') {
      throw Object.assign(new Error('Ative o rascunho pelo formulário do aluno para validar seu planejamento.'), { statusCode: 409 });
    }
    if (status === 'INATIVO') await encerrarVinculosAlunoNaTransacao(tx, aluno);
    await tx.aluno.update({ where: { id }, data: { status } });
    await tx.pessoa.update({ where: { id: aluno.pessoa_id }, data: { status_geral: status } });
    return { id, status };
  }, { isolationLevel: 'ReadCommitted' });
}

async function excluirAlunoService(id) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "aluno" WHERE "id" = ${id} FOR UPDATE`;
    const aluno = await tx.aluno.findUnique({ where: { id } });
    if (!aluno || aluno.deleted_at) throw Object.assign(new Error('Aluno não encontrado.'), { statusCode: 404 });
    await encerrarVinculosAlunoNaTransacao(tx, aluno);
    const responsaveis = await tx.aluno_responsavel.findMany({ where: { aluno_id: id }, select: { pessoa_id: true } });
    const pessoasIds = [...new Set(responsaveis.map((r) => r.pessoa_id))].sort((a, b) => a - b);
    for (const pessoaId of pessoasIds) await tx.$queryRaw`SELECT "id" FROM "pessoa" WHERE "id" = ${pessoaId} FOR UPDATE`;
    await tx.aluno_responsavel.deleteMany({ where: { aluno_id: id } });
    if (pessoasIds.length) await tx.pessoa.deleteMany({ where: {
      id: { in: pessoasIds }, alunos_responsavel: { none: {} },
      aluno: { is: null }, funcionario: { is: null }, usuario: { is: null },
    } });
    await tx.aluno_dados_medicos.deleteMany({ where: { aluno_id: id } });
    await tx.pessoa.update({ where: { id: aluno.pessoa_id }, data: { telefone: null, data_nascimento: null, status_geral: 'INATIVO' } });
    await tx.aluno.update({ where: { id }, data: {
      deleted_at: new Date(), status: aluno.status === 'ATIVO' ? 'INATIVO' : aluno.status,
      turno: null, participa_almoco: null, participa_procan: null, observacoes: null, dias_frequencia: [],
    } });
  }, { isolationLevel: 'ReadCommitted' });
}

module.exports = { criarAlunoService, listarAlunosService, obterAlunoService, obterOficinasService, obterAtendimentosService, editarAlunoService, alterarStatusAlunoService, excluirAlunoService };
