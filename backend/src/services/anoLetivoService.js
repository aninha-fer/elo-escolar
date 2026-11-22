const prisma = require('../prismaClient');
const { criarAnoLetivoDTO, editarAnoLetivoDTO } = require('../dtos/anoLetivoDTO');
const { paginarIds, formatarPagina } = require('./paginacaoService');
const { DIA_MS, hojeInstituicao, diaLetivo, fimLetivo, bloquearCalendarios } = require('./calendarioLetivo');
const { agoraInstituicao, inicioOcorrencia } = require('./encerramentoAtividade');

const erro = (mensagem, statusCode = 409, extras = {}) => Object.assign(new Error(mensagem), { statusCode, ...extras });
const data = (valor) => new Date(`${valor}T00:00:00.000Z`);
const iso = (valor) => valor.toISOString().slice(0, 10);

async function listarAnosLetivosService(paginacao) {
  const pagina = paginacao ? await paginarIds('anos_letivos', paginacao) : null;
  const anos = await prisma.ano_letivo.findMany({
    where: pagina ? { id: { in: pagina.ids } } : {},
    include: { _count: { select: { turmas: true } } }, orderBy: [{ ano: 'desc' }, { id: 'desc' }],
  });
  return formatarPagina(anos.map(({ _count, ...ano }) => ({ ...ano, possui_turmas: _count.turmas > 0 })), pagina);
}

function validarDatas(dados, atual, possuiTurmas = false, hoje = hojeInstituicao()) {
  const novo = { ...atual, ...dados,
    data_inicio: dados.data_inicio === undefined ? atual?.data_inicio : data(dados.data_inicio),
    data_fim: dados.data_fim === undefined ? atual?.data_fim : data(dados.data_fim),
  };
  if (novo.data_fim < novo.data_inicio) throw erro('O término deve ser igual ou posterior ao início.', 400);
  if (!atual && novo.data_fim < hoje) throw erro('O término não pode estar no passado.', 400);
  if (atual) {
    if (dados.ano !== undefined && dados.ano !== atual.ano && possuiTurmas) throw erro('O ano não pode ser alterado porque possui turmas vinculadas.');
    if (+novo.data_inicio !== +atual.data_inicio && (atual.data_inicio <= hoje || novo.data_inicio <= hoje)) {
      throw erro('O início só pode ser alterado antes do início vigente e deve permanecer no futuro.');
    }
    if (+novo.data_fim !== +atual.data_fim && (atual.data_fim < hoje || novo.data_fim < hoje)) {
      throw erro('Não é possível alterar um calendário encerrado nem mover o término para o passado.');
    }
  }
  return novo;
}

async function validarAmpliacao(tx, anteriores, novos) {
  // Apenas a parcela acrescentada pode introduzir conflitos. A sobreposição de calendários não duplica aulas.
  const ampliados = novos.filter((novo) => !anteriores.some((a) => a.data_inicio <= novo.data_inicio && a.data_fim >= novo.data_fim));
  if (!ampliados.length) return;
  const primeiroDia = Math.min(...ampliados.map((c) => +c.data_inicio));
  const ultimoDia = Math.max(...ampliados.map((c) => +c.data_fim));
  const agora = agoraInstituicao();
  const sessoes = await tx.atendimento_sessao.findMany({ where: {
    status: { in: ['ATIVO', 'PROVISORIO'] }, data_cancelamento: null,
    atendimento_clinico: { status: { in: ['ATIVO', 'PROVISORIO'] }, data_cancelamento: null, aluno: { deleted_at: null, status: { in: ['ATIVO', 'RASCUNHO'] } } },
    // Sem limite inferior: uma sessão iniciada antes pode continuar em andamento.
    data_sessao: { lte: new Date(ultimoDia) },
  }, include: { atendimento_clinico: { include: { modalidade_cadastrada: { select: { nome: true } }, aluno: { include: { pessoa: { select: { nome: true } } } } } } } });
  if (!sessoes.length) return;
  const matriculas = await tx.matricula_turma.findMany({ where: {
    aluno_id: { in: [...new Set(sessoes.map((s) => s.atendimento_clinico.aluno_id))] },
    OR: [{ status: 'ATIVO' }, { status: 'PROVISORIO', data_fim: null }, { status: 'INATIVO', data_fim: { not: null } }],
    turma: { tipo: 'OFICINA', status: 'ATIVO', deleted_at: null },
  }, include: { turma: { include: { horarios: true } } } });
  const porAluno = new Map();
  for (const m of matriculas) {
    if (!porAluno.has(m.aluno_id)) porAluno.set(m.aluno_id, []);
    porAluno.get(m.aluno_id).push(m);
  }
  const conflitos = [];
  for (const s of sessoes) {
    const a = s.atendimento_clinico;
    if ((s.status === 'PROVISORIO' || a.status === 'PROVISORIO') && a.aluno.status !== 'RASCUNHO') continue;
    const inicio = inicioOcorrencia(s.data_sessao, s.hora_inicio);
    const fim = inicio + s.duracao_minutos * 60000;
    if (fim <= +agora) continue;
    for (const m of porAluno.get(a.aluno_id) ?? []) {
      if (m.status === 'PROVISORIO' && a.aluno.status !== 'RASCUNHO') continue;
      for (let dia = new Date(Math.max(+s.data_sessao - DIA_MS, primeiroDia)); +dia < Math.min(fim, ultimoDia + DIA_MS); dia.setUTCDate(dia.getUTCDate() + 1)) {
        if (!diaLetivo(novos, dia) || (m.data_inicio && dia < m.data_inicio) || (m.data_fim && dia > m.data_fim)) continue;
        for (const h of m.turma.horarios) {
          if (h.dia_semana !== (dia.getUTCDay() || 7)) continue;
          const de = inicioOcorrencia(dia, h.hora_inicio);
          let ate = inicioOcorrencia(dia, h.hora_fim);
          if (ate < de) ate += DIA_MS;
          if (m.data_fim) ate = Math.min(ate, +m.data_fim + DIA_MS);
          const novoFim = fimLetivo(novos, dia, ate);
          const inicioAcrescentado = Math.max(de, fimLetivo(anteriores, dia, ate));
          if (inicioAcrescentado < fim && novoFim > inicio && novoFim > inicioAcrescentado) conflitos.push({ aluno_id: a.aluno_id, aluno_nome: a.aluno.pessoa.nome,
            turma_id: m.turma_id, oficina_nome: m.turma.nome, atendimento_id: a.id, sessao_id: s.id,
            data: iso(dia), mensagem: `${a.aluno.pessoa.nome}: ${m.turma.nome} conflita com ${a.modalidade_cadastrada.nome} em ${iso(dia)} (${s.hora_inicio.toISOString().slice(11, 16)}).` });
        }
      }
    }
  }
  if (conflitos.length) throw erro('O calendário cria conflitos entre oficinas e atendimentos.', 409, { conflitos });
}

async function salvarAnoLetivo(id, entrada) {
  const dados = (id ? editarAnoLetivoDTO : criarAnoLetivoDTO).parse(entrada);
  return prisma.$transaction(async (tx) => {
    await bloquearCalendarios(tx, true);
    const atual = id ? await tx.ano_letivo.findUnique({ where: { id } }) : null;
    if (id && !atual) throw erro('Calendário não encontrado.', 404);
    const possuiTurmas = id ? await tx.turma.count({ where: { ano_letivo_id: id } }) > 0 : false;
    const novo = validarDatas(dados, atual, possuiTurmas);
    const duplicado = await tx.ano_letivo.findFirst({ where: { ano: novo.ano, ...(id ? { id: { not: id } } : {}) } });
    if (duplicado) throw erro('Já existe um calendário para esse ano.');
    if (atual && +novo.data_fim !== +atual.data_fim && dados.confirmar_alteracao_fim !== `${atual.updated_at.toISOString()}:${iso(novo.data_fim)}`) {
      throw erro('A alteração do término afeta a agenda das turmas regulares vinculadas e das oficinas nesse período.', 409,
        { confirmacao: `${atual.updated_at.toISOString()}:${iso(novo.data_fim)}` });
    }
    const anteriores = await tx.ano_letivo.findMany();
    const novos = [...anteriores.filter((a) => a.id !== id), novo];
    await validarAmpliacao(tx, anteriores, novos);
    if (atual && +atual.data_inicio !== +novo.data_inicio) {
      const matriculas = await tx.matricula_turma.findMany({ where: {
        status: 'ATIVO', data_fim: null, data_inicio: { gt: hojeInstituicao() }, turma: { tipo: 'REGULAR', ano_letivo_id: id },
      } });
      for (const m of matriculas) {
        // Antecipar o calendário move quem aguardava seu início, preservando ingressos posteriores.
        const inicio = +m.data_inicio === +atual.data_inicio ? novo.data_inicio : new Date(Math.max(+m.data_inicio, +novo.data_inicio));
        if (inicio > novo.data_fim) throw erro('O período deixa matrículas futuras sem dias letivos. Revise os vínculos antes de alterá-lo.');
        if (+inicio !== +m.data_inicio) await tx.matricula_turma.update({ where: { id: m.id }, data: { data_inicio: inicio } });
      }
    }
    const persistir = { ano: novo.ano, data_inicio: novo.data_inicio, data_fim: novo.data_fim };
    return id ? tx.ano_letivo.update({ where: { id }, data: persistir }) : tx.ano_letivo.create({ data: persistir });
  }, { isolationLevel: 'ReadCommitted', timeout: 15000 });
}

module.exports = { listarAnosLetivosService, criarAnoLetivoService: (dados) => salvarAnoLetivo(null, dados),
  editarAnoLetivoService: salvarAnoLetivo, validarDatas, validarAmpliacao };
