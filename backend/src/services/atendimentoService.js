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
  const recorrente = tipo_recorrencia !== 'EVENTUAL';
  const datasSessoes = gerarDatasSessoes({
    tipo_recorrencia,
    data_inicio,
    data_termino,
    frequencia,
    dias_semana
  });

  return prisma.$transaction(async (tx) => {
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
  });
}

module.exports = { agendarAtendimentoService, gerarDatasSessoes, obterDatasRecorrentes };
