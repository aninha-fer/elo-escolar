const prisma = require('../prismaClient');

const DIA_MS = 86400000;

function dataAtualInstituicao() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

function obterInicio(data, hora) {
  return data.getTime() + hora.getUTCHours() * 3600000 +
    hora.getUTCMinutes() * 60000 + hora.getUTCSeconds() * 1000;
}

async function obterAgendaAlunoService(aluno_id, dataReferencia) {
  const referencia = dataReferencia ?? dataAtualInstituicao();
  const inicioSemana = new Date(`${referencia}T00:00:00.000Z`);
  if (Number.isNaN(inicioSemana.getTime()) || inicioSemana.toISOString().slice(0, 10) !== referencia) {
    const erro = new Error('Informe uma data válida no formato AAAA-MM-DD.');
    erro.status = 400;
    throw erro;
  }
  inicioSemana.setUTCDate(inicioSemana.getUTCDate() - ((inicioSemana.getUTCDay() + 6) % 7));
  const fimSemana = new Date(inicioSemana.getTime() + 7 * DIA_MS);
  const diaAnterior = new Date(inicioSemana.getTime() - DIA_MS);

  const aluno = await prisma.aluno.findUnique({ where: { id: aluno_id } });
  if (!aluno) {
    const erro = new Error('Aluno não encontrado.');
    erro.status = 404;
    throw erro;
  }

  const [matriculas, sessoes] = await Promise.all([
    prisma.matricula_turma.findMany({
      where: {
        aluno_id, turma: { status: 'ATIVO' },
        OR: [
          { status: 'ATIVO' },
          ...(aluno.status === 'RASCUNHO' ? [{ status: 'PROVISORIO' }] : []),
          { status: 'INATIVO', data_fim: { not: null }, turma: { tipo: 'OFICINA' } }
        ],
        AND: [
          { OR: [{ data_inicio: null }, { data_inicio: { lt: fimSemana } }] },
          { OR: [{ data_fim: null }, { data_fim: { gte: diaAnterior } }] }
        ]
      },
      include: {
        turma: { include: { horarios: true, ambiente: true, profissional: { include: { pessoa: true } } } }
      }
    }),
    prisma.atendimento_sessao.findMany({
      where: {
        status: aluno.status === 'RASCUNHO' ? { in: ['ATIVO', 'PROVISORIO'] } : 'ATIVO',
        atendimento_clinico: { aluno_id, status: aluno.status === 'RASCUNHO' ? { in: ['ATIVO', 'PROVISORIO'] } : 'ATIVO' },
        // Sessões anteriores podem atravessar o início da semana; o intervalo é filtrado abaixo.
        data_sessao: { lt: fimSemana }
      },
      include: { atendimento_clinico: { include: { profissional: { include: { pessoa: true } } } } }
    })
  ]);

  const eventos = [];
  function adicionarEvento(evento, inicio, fim) {
    // Segmentos por dia permitem exibir eventos que atravessam meia-noite e limites da semana.
    let cursor = Math.max(inicio, inicioSemana.getTime());
    const limite = Math.min(fim, fimSemana.getTime());
    while (cursor < limite) {
      const dia = new Date(cursor);
      dia.setUTCHours(0, 0, 0, 0);
      const proximoDia = dia.getTime() + DIA_MS;
      const fimSegmento = Math.min(limite, proximoDia);
      const data = dia.toISOString().slice(0, 10);
      eventos.push({
        ...evento,
        id: `${evento.id}-${data}`,
        data,
        dia_semana: dia.getUTCDay() || 7,
        hora_inicio: new Date(cursor).toISOString().slice(11, 16),
        hora_fim: fimSegmento === proximoDia ? '24:00' : new Date(fimSegmento).toISOString().slice(11, 16)
      });
      cursor = fimSegmento;
    }
  }

  for (const matricula of matriculas) {
    const turma = matricula.turma;
    for (let dia = new Date(diaAnterior); dia < fimSemana; dia.setUTCDate(dia.getUTCDate() + 1)) {
      if ((matricula.data_inicio && dia < matricula.data_inicio) ||
          (matricula.data_fim && dia > matricula.data_fim)) continue;
      for (const horario of turma.horarios) {
        if (horario.dia_semana !== (dia.getUTCDay() || 7)) continue;
        const inicio = obterInicio(dia, horario.hora_inicio);
        let fim = obterInicio(dia, horario.hora_fim);
        if (fim < inicio) fim += DIA_MS;
        if (matricula.data_fim) fim = Math.min(fim, matricula.data_fim.getTime() + DIA_MS);
        adicionarEvento({
          id: `turma-${matricula.id}-${horario.id}-${dia.toISOString().slice(0, 10)}`,
          matricula_id: matricula.id, turma_id: turma.id, turma_nome: turma.nome,
          titulo: turma.nome, tipo: turma.tipo,
          status: matricula.status,
          ambiente: turma.ambiente?.nome || 'Não definido',
          profissional: turma.profissional?.pessoa?.nome || 'Não definido'
        }, inicio, fim);
      }
    }
  }

  for (const sessao of sessoes) {
    const atendimento = sessao.atendimento_clinico;
    const inicio = obterInicio(sessao.data_sessao, sessao.hora_inicio);
    const fim = inicio + sessao.duracao_minutos * 60000;
    adicionarEvento({
      id: `atendimento-${sessao.id}`,
      sessao_id: sessao.id, atendimento_id: sessao.atendimento_clinico_id,
      titulo: atendimento.modalidade, modalidade: atendimento.modalidade, tipo: 'ATENDIMENTO',
      status: sessao.status,
      ambiente: null, profissional: atendimento.profissional?.pessoa?.nome || 'Não definido'
    }, inicio, fim);
  }

  eventos.sort((a, b) => a.data.localeCompare(b.data) ||
    a.hora_inicio.localeCompare(b.hora_inicio) || a.id.localeCompare(b.id));

  return {
    semana_inicio: inicioSemana.toISOString().slice(0, 10),
    semana_fim: new Date(fimSemana.getTime() - DIA_MS).toISOString().slice(0, 10),
    eventos
  };
}

module.exports = { obterAgendaAlunoService };
