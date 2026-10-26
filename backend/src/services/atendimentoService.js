const prisma = require('../prismaClient');

const DIAS_DA_SEMANA = new Set([1, 2, 3, 4, 5, 6, 7]);

function criarErroValidacao(mensagem) {
  const erro = new Error(mensagem);
  erro.statusCode = 400;
  return erro;
}

function converterData(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw criarErroValidacao('Informe uma data válida no formato AAAA-MM-DD.');
  }

  const dataConvertida = new Date(`${data}T00:00:00.000Z`);
  if (Number.isNaN(dataConvertida.getTime()) || dataConvertida.toISOString().slice(0, 10) !== data) {
    throw criarErroValidacao('Informe uma data válida no formato AAAA-MM-DD.');
  }

  return dataConvertida;
}

function converterHora(hora) {
  if (typeof hora !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    throw criarErroValidacao('Informe uma hora válida no formato HH:mm.');
  }

  return new Date(`1970-01-01T${hora}:00.000Z`);
}

function validarInicioNaoPassado(data, hora) {
  const agora = new Date();
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(agora);
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  // Compara datas civis no mesmo fuso sem reinterpretar os campos persistidos como UTC.
  const instanteAtual = `${valor('year')}-${valor('month')}-${valor('day')}T${valor('hour')}:${valor('minute')}:${valor('second')}.${String(agora.getUTCMilliseconds()).padStart(3, '0')}`;
  if (`${data}T${hora}:00.000` < instanteAtual) {
    throw criarErroValidacao('Não é possível agendar um atendimento em uma data ou horário no passado.');
  }
}

function obterDatasRecorrentes({ tipo_recorrencia, data_inicio, data_termino, frequencia, dias_semana }) {
  const inicio = converterData(data_inicio);
  const termino = data_termino ? converterData(data_termino) : null;

  if (!Number.isInteger(frequencia) || frequencia < 1) {
    throw criarErroValidacao('A frequência deve ser um número inteiro maior que zero.');
  }
  if (!termino) {
    throw criarErroValidacao('A data de término é obrigatória para atendimentos recorrentes.');
  }
  if (termino < inicio) {
    throw criarErroValidacao('A data de término não pode ser anterior à data de início.');
  }

  const datas = [];

  if (tipo_recorrencia === 'SEMANAL') {
    if (!Array.isArray(dias_semana) || dias_semana.length === 0) {
      throw criarErroValidacao('Selecione ao menos um dia da semana para a recorrência semanal.');
    }
    if (dias_semana.some((dia) => !DIAS_DA_SEMANA.has(dia))) {
      throw criarErroValidacao('Os dias da semana devem ser números de 1 (segunda) a 7 (domingo).');
    }

    const diasSelecionados = new Set(dias_semana);
    const inicioSemana = new Date(inicio);
    inicioSemana.setUTCDate(inicioSemana.getUTCDate() - ((inicioSemana.getUTCDay() + 6) % 7));

    for (let data = new Date(inicio); data <= termino; data.setUTCDate(data.getUTCDate() + 1)) {
      const semanasDesdeInicio = Math.floor((data - inicioSemana) / (7 * 24 * 60 * 60 * 1000));
      const diaSemana = data.getUTCDay() || 7;

      if (semanasDesdeInicio % frequencia === 0 && diasSelecionados.has(diaSemana)) {
        datas.push(new Date(data));
      }
    }
  } else {
    const diaDoMes = inicio.getUTCDate();
    let incrementoMeses = 0;

    while (true) {
      const dataDoMes = new Date(Date.UTC(
        inicio.getUTCFullYear(),
        inicio.getUTCMonth() + incrementoMeses,
        1
      ));
      const ultimoDiaDoMes = new Date(Date.UTC(
        dataDoMes.getUTCFullYear(),
        dataDoMes.getUTCMonth() + 1,
        0
      )).getUTCDate();
      const dataOcorrencia = new Date(Date.UTC(
        dataDoMes.getUTCFullYear(),
        dataDoMes.getUTCMonth(),
        Math.min(diaDoMes, ultimoDiaDoMes)
      ));

      if (dataOcorrencia > termino) {
        break;
      }
      datas.push(dataOcorrencia);
      incrementoMeses += frequencia;
    }
  }

  if (datas.length === 0) {
    throw criarErroValidacao('Não há sessões dentro do período informado.');
  }

  return datas;
}

function gerarDatasSessoes(dadosAtendimento) {
  if (dadosAtendimento.tipo_recorrencia === 'EVENTUAL') {
    return [converterData(dadosAtendimento.data_inicio)];
  }

  return obterDatasRecorrentes(dadosAtendimento);
}

function obterInicioSessao(data, hora) {
  return data.getTime() + hora.getUTCHours() * 3600000 +
    hora.getUTCMinutes() * 60000 + hora.getUTCSeconds() * 1000;
}

function obterDia(data) {
  const dia = new Date(data);
  dia.setUTCHours(0, 0, 0, 0);
  return dia;
}

function formatarIntervalo(inicio, fim) {
  return {
    data_sessao: new Date(inicio).toISOString().slice(0, 10),
    hora_inicio: new Date(inicio).toISOString().slice(11, 16),
    data_fim: new Date(fim).toISOString().slice(0, 10),
    hora_fim: new Date(fim).toISOString().slice(11, 16)
  };
}

async function validarDisponibilidade(tx, { aluno_id, datasSessoes, hora_inicio, duracao_minutos }) {
  // O bloqueio por aluno serializa criações concorrentes antes de consultar a agenda.
  await tx.$queryRaw`SELECT "id" FROM "aluno" WHERE "id" = ${aluno_id} FOR UPDATE`;

  const aluno = await tx.aluno.findUnique({
    where: { id: aluno_id },
    select: { dias_frequencia: true }
  });
  if (!aluno) {
    const erro = new Error('Aluno não encontrado.');
    erro.statusCode = 404;
    throw erro;
  }

  const intervalos = datasSessoes.map((data) => {
    const inicio = obterInicioSessao(data, hora_inicio);
    return { inicio, fim: inicio + duracao_minutos * 60000 };
  });
  const primeiroInicio = intervalos[0].inicio;
  const ultimoFim = intervalos[intervalos.length - 1].fim;

  const sessoes = await tx.atendimento_sessao.findMany({
    where: {
      status: 'ATIVO',
      atendimento_clinico: { aluno_id, status: 'ATIVO' },
      // Sem limite inferior: uma sessão iniciada antes pode avançar para o período solicitado.
      data_sessao: { lte: obterDia(ultimoFim - 1) }
    },
    select: {
      id: true, atendimento_clinico_id: true, data_sessao: true,
      hora_inicio: true, duracao_minutos: true,
      atendimento_clinico: { select: { modalidade: true } }
    }
  });
  const compromissos = sessoes.map((sessao) => {
    const inicio = obterInicioSessao(sessao.data_sessao, sessao.hora_inicio);
    return { sessao, inicio, fim: inicio + sessao.duracao_minutos * 60000 };
  }).filter(({ inicio, fim }) => inicio < ultimoFim && fim > primeiroInicio);

  const matriculas = await tx.matricula_turma.findMany({
    where: {
      aluno_id,
      OR: [{ status: 'ATIVO' }, { status: 'INATIVO', data_fim: { not: null } }],
      turma: { tipo: 'OFICINA', status: 'ATIVO' },
      AND: [
        { OR: [{ data_inicio: null }, { data_inicio: { lte: obterDia(ultimoFim - 1) } }] },
        { OR: [{ data_fim: null }, { data_fim: { gte: obterDia(primeiroInicio - 86400000) } }] }
      ]
    },
    include: { turma: { include: { horarios: true } } }
  });
  const conflitos = [];

  for (const { inicio, fim } of intervalos) {
    const solicitado = formatarIntervalo(inicio, fim);
    for (const compromisso of compromissos) {
      if (inicio < compromisso.fim && fim > compromisso.inicio) {
        conflitos.push({
          codigo: 'CHOQUE_HORARIO_ATENDIMENTO',
          ...solicitado,
          detalhes: {
            sessao_id: compromisso.sessao.id,
            atendimento_id: compromisso.sessao.atendimento_clinico_id,
            modalidade: compromisso.sessao.atendimento_clinico.modalidade,
            ...formatarIntervalo(compromisso.inicio, compromisso.fim)
          }
        });
      }
    }

    for (let dia = obterDia(inicio); dia.getTime() < fim; dia.setUTCDate(dia.getUTCDate() + 1)) {
      const diaSemana = dia.getUTCDay() || 7;
      if (!aluno.dias_frequencia.includes(diaSemana)) {
        conflitos.push({
          codigo: 'FREQUENCIA_INSUFICIENTE',
          ...solicitado,
          detalhes: { data: dia.toISOString().slice(0, 10), dia_semana: diaSemana }
        });
      }
    }

    for (let dia = obterDia(inicio - 86400000); dia.getTime() < fim; dia.setUTCDate(dia.getUTCDate() + 1)) {
      for (const matricula of matriculas) {
        if ((matricula.data_inicio && dia < matricula.data_inicio) ||
            (matricula.data_fim && dia > matricula.data_fim)) continue;

        for (const horario of matricula.turma.horarios) {
          if (horario.dia_semana !== (dia.getUTCDay() || 7)) continue;
          const inicioOficina = obterInicioSessao(dia, horario.hora_inicio);
          let fimOficina = obterInicioSessao(dia, horario.hora_fim);
          if (fimOficina < inicioOficina) fimOficina += 86400000;
          if (matricula.data_fim) fimOficina = Math.min(fimOficina, matricula.data_fim.getTime() + 86400000);
          if (inicio < fimOficina && fim > inicioOficina) {
            conflitos.push({
              codigo: 'CHOQUE_HORARIO_OFICINA',
              ...solicitado,
              detalhes: {
                matricula_id: matricula.id,
                turma_id: matricula.turma_id,
                oficina_nome: matricula.turma.nome,
                ...formatarIntervalo(inicioOficina, fimOficina)
              }
            });
          }
        }
      }
    }
  }

  if (conflitos.length > 0) {
    const erro = new Error('Conflitos de agenda identificados.');
    erro.isConflict = true;
    erro.detalhes = conflitos;
    throw erro;
  }
}

async function agendarAtendimentoService(dadosAtendimento) {
  const {
    profissional_id,
    aluno_id,
    modalidade,
    tipo_recorrencia,
    data_inicio,
    hora_inicio,
    duracao_minutos,
    frequencia,
    dias_semana = [],
    data_termino
  } = dadosAtendimento;

  if (!Number.isInteger(aluno_id) || aluno_id < 1) {
    throw criarErroValidacao('Aluno não identificado.');
  }
  if (!Number.isInteger(profissional_id) || profissional_id < 1) {
    throw criarErroValidacao('Profissional não identificado.');
  }
  if (typeof modalidade !== 'string' || !modalidade.trim()) {
    throw criarErroValidacao('Modalidade não identificada.');
  }
  if (!['EVENTUAL', 'SEMANAL', 'MENSAL'].includes(tipo_recorrencia)) {
    throw criarErroValidacao('Tipo de recorrência inválido.');
  }
  if (!Number.isInteger(duracao_minutos) || duracao_minutos < 1) {
    throw criarErroValidacao('A duração deve ser um número inteiro maior que zero.');
  }

  const dataInicioConvertida = converterData(data_inicio);
  const horaInicioConvertida = converterHora(hora_inicio);
  validarInicioNaoPassado(data_inicio, hora_inicio);
  const recorrente = tipo_recorrencia !== 'EVENTUAL';
  const datasSessoes = gerarDatasSessoes({
    tipo_recorrencia,
    data_inicio,
    data_termino,
    frequencia,
    dias_semana
  });

  return prisma.$transaction(async (tx) => {
    await validarDisponibilidade(tx, {
      aluno_id, datasSessoes, hora_inicio: horaInicioConvertida, duracao_minutos
    });

    validarInicioNaoPassado(data_inicio, hora_inicio);
    const atendimento = await tx.atendimento_clinico.create({
      data: {
        aluno_id,
        profissional_id,
        modalidade: modalidade.trim(),
        tipo_recorrencia,
        data_inicio: dataInicioConvertida,
        hora_inicio: horaInicioConvertida,
        duracao_minutos,
        frequencia: recorrente ? frequencia : null,
        dias_semana: tipo_recorrencia === 'SEMANAL' ? [...new Set(dias_semana)] : [],
        data_termino: recorrente ? converterData(data_termino) : null,
        status: 'ATIVO'
      }
    });

    await tx.atendimento_sessao.createMany({
      data: datasSessoes.map((data_sessao) => ({
        atendimento_clinico_id: atendimento.id,
        data_sessao,
        hora_inicio: horaInicioConvertida,
        duracao_minutos,
        status: 'ATIVO'
      }))
    });

    return tx.atendimento_clinico.findUnique({
      where: { id: atendimento.id },
      include: { sessoes: true }
    });
  }, { isolationLevel: 'ReadCommitted' });
}

async function listarProfissionaisAtendimentoService() {
  const profissionais = await prisma.funcionario.findMany({
    where: { pessoa: { status_geral: 'ATIVO' } },
    select: { id: true, cargo: true, pessoa: { select: { nome: true } } },
    orderBy: [{ pessoa: { nome: 'asc' } }, { id: 'asc' }]
  });
  return profissionais.map(({ id, cargo, pessoa }) => ({ id, nome: pessoa.nome, cargo }));
}

module.exports = { agendarAtendimentoService, gerarDatasSessoes, obterDatasRecorrentes, listarProfissionaisAtendimentoService };
