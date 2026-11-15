const prisma = require('../prismaClient');
const { obterStatusVinculo } = require('./matriculaService');

const { agoraInstituicao } = require('./encerramentoAtividade');
const { criarAtendimentoDTO, editarAtendimentoDTO } = require('../dtos/atendimentoDTO');

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
    if (inicio.getUTCDay() === 0 || inicio.getUTCDay() === 6) {
      throw criarErroValidacao('A data de início da recorrência mensal deve ser de segunda a sexta-feira.');
    }
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
      const diaSemana = dataOcorrencia.getUTCDay();
      if (diaSemana === 0 || diaSemana === 6) {
        dataOcorrencia.setUTCDate(dataOcorrencia.getUTCDate() - (diaSemana === 6 ? 1 : 2));
      }

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

async function validarDisponibilidade(tx, { aluno_id, datasSessoes, hora_inicio, duracao_minutos, ignorarSessoes = [] }) {
  // O bloqueio por aluno serializa criações concorrentes antes de consultar a agenda.
  await tx.$queryRaw`SELECT "id" FROM "aluno" WHERE "id" = ${aluno_id} FOR UPDATE`;

  const aluno = await tx.aluno.findUnique({
    where: { id: aluno_id },
    select: { dias_frequencia: true, status: true }
  });
  if (!aluno) {
    const erro = new Error('Aluno não encontrado.');
    erro.statusCode = 404;
    throw erro;
  }
  const statusVinculo = obterStatusVinculo(aluno);
  const status = statusVinculo === 'PROVISORIO' ? { in: ['ATIVO', 'PROVISORIO'] } : 'ATIVO';

  const intervalos = datasSessoes.map((data) => {
    const inicio = obterInicioSessao(data, hora_inicio);
    return { inicio, fim: inicio + duracao_minutos * 60000 };
  });
  const primeiroInicio = intervalos[0].inicio;
  const ultimoFim = intervalos[intervalos.length - 1].fim;

  const sessoes = await tx.atendimento_sessao.findMany({
    where: {
      status,
      data_cancelamento: null,
      ...(ignorarSessoes.length ? { id: { notIn: ignorarSessoes } } : {}),
      atendimento_clinico: { aluno_id, status, data_cancelamento: null },
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
      OR: [{ status: 'ATIVO' }, { status: 'INATIVO', data_fim: { not: null } },
        ...(statusVinculo === 'PROVISORIO' ? [{ status: 'PROVISORIO', data_fim: null }] : [])],
      turma: { tipo: 'OFICINA', status: 'ATIVO' },
      AND: [
        { OR: [{ data_inicio: null }, { data_inicio: { lte: obterDia(ultimoFim - 1) } }] },
        { OR: [{ data_fim: null }, { data_fim: { gte: obterDia(primeiroInicio - 86400000) } }] }
      ]
    },
    include: { turma: { include: { horarios: true } } }
  });
  const conflitos = [];
  for (let i = 1; i < intervalos.length; i++) {
    if (intervalos[i - 1].fim > intervalos[i].inicio) conflitos.push({ codigo: 'CHOQUE_SESSOES_RECORRENCIA', mensagem: 'As sessões da recorrência se sobrepõem entre si.' });
  }

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
  return statusVinculo;
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
    const statusVinculo = await validarDisponibilidade(tx, {
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
        status: statusVinculo
      }
    });

    await tx.atendimento_sessao.createMany({
      data: datasSessoes.map((data_sessao) => ({
        atendimento_clinico_id: atendimento.id,
        profissional_id,
        data_sessao,
        hora_inicio: horaInicioConvertida,
        duracao_minutos,
        status: statusVinculo
      }))
    });

    return tx.atendimento_clinico.findUnique({
      where: { id: atendimento.id },
      include: { sessoes: true }
    });
  }, { isolationLevel: 'ReadCommitted' });
}

async function removerAtendimentoProvisorioService({ aluno_id, atendimento_id }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "aluno" WHERE "id" = ${aluno_id} FOR UPDATE`;
    const atendimento = await tx.atendimento_clinico.findFirst({
      where: { id: atendimento_id, aluno_id }, include: { aluno: { select: { status: true } } }
    });
    if (!atendimento) {
      const erro = new Error('Atendimento não encontrado para este aluno.');
      erro.statusCode = 404;
      throw erro;
    }
    if (atendimento.status !== 'PROVISORIO' || atendimento.aluno.status !== 'RASCUNHO') {
      const erro = new Error('Somente atendimentos provisórios de um rascunho podem ser removidos do planejamento.');
      erro.statusCode = 409;
      throw erro;
    }
    if (atendimento.data_cancelamento) return { mensagem: 'Atendimento provisório já encerrado.' };
    const sessoesEfetivas = await tx.atendimento_sessao.count({
      where: { atendimento_clinico_id: atendimento_id, status: { not: 'PROVISORIO' } }
    });
    if (sessoesEfetivas) {
      const erro = new Error('O atendimento possui sessões efetivas e não pode ser removido do planejamento.');
      erro.statusCode = 409;
      throw erro;
    }
    const completo = await tx.atendimento_clinico.findFirst({ where: { id: atendimento_id, aluno_id }, include: { sessoes: true } });
    await cancelarAtendimentoNaTransacao(tx, completo, agoraInstituicao());
    return { mensagem: 'Atendimento provisório encerrado. Os registros foram preservados.' };
  }, { isolationLevel: 'ReadCommitted' });
}

function inicioSessao(sessao) {
  return obterInicioSessao(sessao.data_sessao, sessao.hora_inicio);
}

function restricoesAtendimento(atendimento, agora) {
  const sessoes = atendimento.sessoes.filter((s) => !s.data_cancelamento && s.status !== 'INATIVO');
  const primeiroInicio = sessoes.length ? Math.min(...sessoes.map(inicioSessao)) : null;
  const iniciou = primeiroInicio !== null && primeiroInicio <= agora.getTime();
  return { possui_sessoes_iniciadas: iniciou,
    inicio_primeira_sessao: primeiroInicio === null ? null : new Date(primeiroInicio).toISOString().slice(0, -1),
    pode_editar: !atendimento.data_cancelamento && atendimento.status !== 'INATIVO'
      && (atendimento.tipo_recorrencia !== 'EVENTUAL' || (!iniciou && obterInicioSessao(atendimento.data_inicio, atendimento.hora_inicio) > agora.getTime())) };
}

async function buscarAtendimento(tx, aluno_id, atendimento_id) {
  const atendimento = await tx.atendimento_clinico.findFirst({ where: { id: atendimento_id, aluno_id },
    include: { sessoes: true, profissional: { select: { id: true, pessoa: { select: { nome: true } } } } } });
  if (!atendimento) throw Object.assign(new Error('Atendimento não encontrado para este aluno.'), { statusCode: 404 });
  return atendimento;
}

function respostaAtendimento(atendimento, agora) {
  const { sessoes, ...dados } = atendimento;
  return { ...dados, ...restricoesAtendimento(atendimento, agora) };
}

async function obterAtendimentoService({ aluno_id, atendimento_id }) {
  return respostaAtendimento(await buscarAtendimento(prisma, aluno_id, atendimento_id), agoraInstituicao());
}

async function cancelarAtendimentoNaTransacao(tx, atendimento, agora) {
  if (atendimento.data_cancelamento) return;
  const hoje = obterDia(agora.getTime());
  const futuras = atendimento.sessoes.filter((s) => !s.data_cancelamento && s.status !== 'INATIVO' && inicioSessao(s) > agora.getTime());
  await tx.atendimento_sessao.updateMany({ where: { id: { in: futuras.map((s) => s.id) }, data_cancelamento: null },
    data: { data_cancelamento: hoje, ...(atendimento.status === 'PROVISORIO' ? {} : { status: 'INATIVO' }) } });
  await tx.atendimento_clinico.update({ where: { id: atendimento.id },
    data: { data_cancelamento: hoje, ...(atendimento.status === 'PROVISORIO' ? {} : { status: 'INATIVO' }) } });
}

async function cancelarAtendimentoService({ aluno_id, atendimento_id }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "aluno" WHERE "id" = ${aluno_id} FOR UPDATE`;
    const atendimento = await buscarAtendimento(tx, aluno_id, atendimento_id);
    await cancelarAtendimentoNaTransacao(tx, atendimento, agoraInstituicao());
    return { mensagem: 'Atendimento cancelado. As sessões já iniciadas foram preservadas.' };
  }, { isolationLevel: 'ReadCommitted' });
}

async function editarAtendimentoService({ aluno_id, atendimento_id }, entrada) {
  const dados = editarAtendimentoDTO.parse(entrada);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "aluno" WHERE "id" = ${aluno_id} FOR UPDATE`;
    const atual = await buscarAtendimento(tx, aluno_id, atendimento_id);
    const agora = agoraInstituicao();
    const restricoes = restricoesAtendimento(atual, agora);
    if (!restricoes.pode_editar) throw Object.assign(new Error('Este atendimento já foi cancelado ou não permite edição após seu início.'), { statusCode: 409 });
    const eventual = atual.tipo_recorrencia === 'EVENTUAL';
    if (dados.tipo_recorrencia && eventual !== (dados.tipo_recorrencia === 'EVENTUAL')) {
      throw criarErroValidacao('Não é permitido converter atendimento eventual em recorrente ou vice-versa.');
    }
    const base = { ...atual, data_inicio: atual.data_inicio.toISOString().slice(0, 10),
      hora_inicio: atual.hora_inicio.toISOString().slice(11, 16), data_termino: atual.data_termino?.toISOString().slice(0, 10),
      frequencia: atual.frequencia ?? undefined };
    if (restricoes.possui_sessoes_iniciadas && ['data_inicio', 'modalidade', 'tipo_recorrencia'].some((c) => dados[c] !== undefined && dados[c] !== base[c])) {
      throw Object.assign(new Error('Após o início de uma sessão, não é permitido alterar modalidade, data inicial ou tipo de recorrência.'), { statusCode: 409 });
    }
    if (dados.tipo_recorrencia && dados.tipo_recorrencia !== atual.tipo_recorrencia &&
      (dados.frequencia === undefined || (dados.tipo_recorrencia === 'SEMANAL' && !dados.dias_semana?.length))) {
      throw criarErroValidacao('Ao mudar o tipo de recorrência, informe novamente a frequência e os dias exigidos pelo novo tipo.');
    }
    const completos = criarAtendimentoDTO.parse({ ...base, ...dados });
    const campos = Object.keys(dados).filter((campo) => JSON.stringify(campo === 'dias_semana' ? [...new Set(dados[campo])].sort() : completos[campo])
      !== JSON.stringify(campo === 'dias_semana' ? [...new Set(base[campo])].sort() : base[campo]));
    if (eventual && ['frequencia', 'dias_semana', 'data_termino'].some((c) => c in dados)) throw criarErroValidacao('Atendimentos eventuais não possuem configuração de recorrência.');
    if (completos.profissional_id !== atual.profissional_id) {
      const profissional = await tx.funcionario.findUnique({ where: { id: completos.profissional_id }, select: { pessoa: { select: { status_geral: true } } } });
      if (!profissional || profissional.pessoa.status_geral !== 'ATIVO') throw criarErroValidacao('Selecione um profissional ativo.');
    }
    const aluno = await tx.aluno.findUnique({ where: { id: aluno_id } });
    const status = obterStatusVinculo(aluno);
    const futuras = atual.sessoes.filter((s) => !s.data_cancelamento && s.status !== 'INATIVO' && inicioSessao(s) > agora.getTime());
    const mudouAgenda = campos.some((c) => ['data_inicio', 'hora_inicio', 'duracao_minutos', 'frequencia', 'dias_semana', 'data_termino', 'tipo_recorrencia'].includes(c));
    const hora = converterHora(completos.hora_inicio);
    const diasProtegidos = new Set(atual.sessoes.filter((s) => !s.data_cancelamento && s.status !== 'INATIVO' && inicioSessao(s) <= agora.getTime()).map((s) => s.data_sessao.getTime()));
    const datas = mudouAgenda ? gerarDatasSessoes(completos).filter((d) => obterInicioSessao(d, hora) > agora.getTime() && !diasProtegidos.has(d.getTime())) : futuras.map((s) => s.data_sessao);
    if (eventual || campos.includes('data_inicio')) validarInicioNaoPassado(completos.data_inicio, completos.hora_inicio);
    if (mudouAgenda && !restricoes.possui_sessoes_iniciadas && !datas.length) throw criarErroValidacao('Não há sessões futuras na configuração informada.');
    if (restricoes.possui_sessoes_iniciadas && completos.data_termino) {
      const limite = converterData(completos.data_termino).getTime() + 86400000;
      if (atual.sessoes.some((s) => !s.data_cancelamento && s.status !== 'INATIVO' && inicioSessao(s) <= agora.getTime() && inicioSessao(s) >= limite)) {
        throw criarErroValidacao('A data de término não pode excluir sessões já iniciadas.');
      }
    }
    if (mudouAgenda && datas.length) await validarDisponibilidade(tx, { aluno_id, datasSessoes: datas,
      hora_inicio: hora, duracao_minutos: completos.duracao_minutos, ignorarSessoes: futuras.map((s) => s.id) });
    const usados = new Set();
    for (const data_sessao of datas) {
      const existente = futuras.find((s) => !usados.has(s.id) && s.data_sessao.getTime() === data_sessao.getTime());
      const valores = { data_sessao, hora_inicio: hora, duracao_minutos: completos.duracao_minutos, profissional_id: completos.profissional_id, status };
      if (existente) { usados.add(existente.id); await tx.atendimento_sessao.update({ where: { id: existente.id }, data: valores }); }
      else await tx.atendimento_sessao.create({ data: { ...valores, atendimento_clinico_id: atendimento_id } });
    }
    await tx.atendimento_sessao.updateMany({ where: { id: { in: futuras.filter((s) => !usados.has(s.id)).map((s) => s.id) }, data_cancelamento: null },
      data: { data_cancelamento: obterDia(agora.getTime()), ...(status === 'PROVISORIO' ? {} : { status: 'INATIVO' }) } });
    await tx.atendimento_clinico.update({ where: { id: atendimento_id }, data: {
      profissional_id: completos.profissional_id, modalidade: completos.modalidade, tipo_recorrencia: completos.tipo_recorrencia,
      data_inicio: converterData(completos.data_inicio), hora_inicio: hora, duracao_minutos: completos.duracao_minutos,
      frequencia: eventual ? null : completos.frequencia, dias_semana: completos.tipo_recorrencia === 'SEMANAL' ? [...new Set(completos.dias_semana)].sort((a,b) => a-b) : [],
      data_termino: eventual ? null : converterData(completos.data_termino), status
    } });
    return respostaAtendimento(await buscarAtendimento(tx, aluno_id, atendimento_id), agora);
  }, { isolationLevel: 'ReadCommitted' });
}

module.exports = { agendarAtendimentoService, gerarDatasSessoes, obterDatasRecorrentes,
  removerAtendimentoProvisorioService, obterAtendimentoService, editarAtendimentoService, cancelarAtendimentoService };
