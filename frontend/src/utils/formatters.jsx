export function formatarDataBR(dataIso) {
    if (!dataIso) return '-';
    const [ano, mes, dia] = dataIso.split('T')[0].split('-');
    return `${dia}/${mes}/${ano}`;
}

export function formatarDataHoraInstituicao(data = new Date()) {
    const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(data);
    const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
    return `${valor('year')}-${valor('month')}-${valor('day')}T${valor('hour')}:${valor('minute')}:${valor('second')}.${String(data.getUTCMilliseconds()).padStart(3, '0')}`;
}

export function formatarTurno(turno) {
    if (turno === 'MANHA' || turno === 'MANHÃ') return 'Manhã';
    if (turno === 'TARDE') return 'Tarde';
    return 'Não definido';
}

export function converterHora(hora) {
    if (!hora) return null;

    const [horas, minutos] = hora.split(':').map(Number);
    if (Number.isNaN(horas) || Number.isNaN(minutos)) return null;

    return horas + minutos / 60;
}

export function formatarHora(hora) {
    return hora?.slice(0, 5) ?? '--:--';
}

const diasDaSemana = {
    1: 'Seg',
    2: 'Ter',
    3: 'Qua',
    4: 'Qui',
    5: 'Sex',
    6: 'Sáb',
    7: 'Dom',
};

export function formatarFrequencia(dias = []) {
    return dias
        .map((dia) => diasDaSemana[dia] ?? dia)
        .join(', ');
}

export function formatarStatus(status) {
    const rotulos = {
        ATIVO: 'Ativo',
        INATIVO: 'Inativo',
        RASCUNHO: 'Rascunho',
    };

    return rotulos[status] ?? status ?? 'Não definido';
}

export function formatarTelefone(telefone) {
    if (!telefone) return null;

  const apenasNumeros = String(telefone).replace(/\D/g, '');

  if (apenasNumeros.length === 11) {
    return apenasNumeros.replace(/^(\d{2})(\d{1})(\d{4})(\d{4})$/, '($1) $2 $3-$4');
  }

  if (apenasNumeros.length === 10) {
    return apenasNumeros.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }

  return String(telefone);
}

export function formatarMensagemConflito(conflito) {
    if (typeof conflito === 'string') {
        return conflito;
    }

    if (!conflito || (!conflito.codigo && !conflito.mensagem)) {
        return 'Conflito de agenda não identificado.';
    }

    const prefixoOficina = conflito.oficina_nome ? `[${conflito.oficina_nome}] ` : '';

    switch (conflito.codigo) {
        case 'TURNO_INCOMPATIVEL': {
            const turnoOficina = formatarTurno(conflito.detalhes?.turno_oficina);
            const turnoAluno = formatarTurno(conflito.detalhes?.turno_aluno);
            return `${prefixoOficina}Ocorre no turno ${turnoOficina}, incompatível com o turno ${turnoAluno} do aluno.`;
        }

        case 'FREQUENCIA_INSUFICIENTE': {
            if (conflito.detalhes?.data) {
                const { data, dia_semana } = conflito.detalhes;
                return `O aluno não possui frequência registrada em ${formatarDataBR(data)} (${formatarFrequencia([dia_semana])}).`;
            }
            const diasExigidos = conflito.detalhes?.dias_exigidos;
            const diasFormatados = Array.isArray(diasExigidos)
                ? formatarFrequencia(diasExigidos)
                : diasExigidos;
            return `${prefixoOficina}Exige presença em dias em que o aluno não frequenta a instituição: ${diasFormatados}.`;
        }

        case 'CAPACIDADE_MAXIMA': {
            const capacidade = conflito.detalhes?.capacidade;
            return `${prefixoOficina}Turma sem vagas disponíveis (Capacidade máxima: ${capacidade}).`;
        }

        case 'MATRICULA_DUPLICADA': {
            return `${prefixoOficina}O aluno já possui uma matrícula ativa nesta oficina.`;
        }

        case 'OFICINAS_SIMULTANEAS': {
            const { oficina_1, oficina_2, dia_semana } = conflito.detalhes || {};
            const diaFormatado = dia_semana ? ` (${formatarFrequencia([dia_semana])})` : '';
            return `Choque de horário: As oficinas "${oficina_1}" e "${oficina_2}" ocorrem no mesmo horário${diaFormatado}.`;
        }

        case 'CHOQUE_HORARIO_OFICINA': {
            if (conflito.detalhes?.oficina_nome) {
                const { oficina_nome, hora_inicio, hora_fim } = conflito.detalhes;
                const data = conflito.data_sessao ? ` em ${formatarDataBR(conflito.data_sessao)}` : '';
                return `O atendimento${data} coincide com a oficina "${oficina_nome}" (${formatarHora(hora_inicio)} até ${formatarHora(hora_fim)}).`;
            }
            const { oficina_matriculada, dia_semana } = conflito.detalhes || {};
            const diaFormatado = dia_semana ? ` (${formatarFrequencia([dia_semana])})` : '';
            return `${prefixoOficina} - Possui choque de horário com a oficina "${oficina_matriculada}", na qual o aluno já está matriculado${diaFormatado}.`;
        }

        case 'CHOQUE_HORARIO_ATENDIMENTO':
        case 'CHOQUE_HORARIO_CLINICO': {
            const detalhes = conflito.detalhes || {};
            const atendimento = detalhes.modalidade || detalhes.atendimento_nome || detalhes.conflito_com || 'Atendimento Clínico';
            const data = detalhes.data_sessao ? ` em ${formatarDataBR(detalhes.data_sessao)}` : '';
            const dataFim = detalhes.data_fim && detalhes.data_fim !== detalhes.data_sessao
                ? `${formatarDataBR(detalhes.data_fim)} às ` : '';
            const horario = detalhes.hora_inicio && detalhes.hora_fim
                ? ` (${formatarHora(detalhes.hora_inicio)} até ${dataFim}${formatarHora(detalhes.hora_fim)})`
                : detalhes.horario ? ` às ${detalhes.horario}` : '';
            return `${prefixoOficina}Possui choque de horário com o atendimento de saúde (${atendimento})${data}${horario}.`;
        }

        default:
            return conflito.mensagem || `${prefixoOficina}Conflito identificado na solicitação.`;
    }
}
