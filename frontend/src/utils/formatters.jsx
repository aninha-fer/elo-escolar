export function formatarDataBR(dataIso) {
    if (!dataIso) return '-';
    const [ano, mes, dia] = dataIso.split('T')[0].split('-');
    return `${dia}/${mes}/${ano}`;
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
            const diasExigidos = conflito.detalhes?.dias_exigidos;
            const diasFormatados = Array.isArray(diasExigidos)
                ? formatarDiasSemana(diasExigidos)
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
            const { oficina_matriculada, dia_semana } = conflito.detalhes || {};
            const diaFormatado = dia_semana ? ` (${formatarFrequencia([dia_semana])})` : '';
            return `${prefixoOficina} - Possui choque de horário com a oficina "${oficina_matriculada}", na qual o aluno já está matriculado${diaFormatado}.`;
        }

        case 'CHOQUE_HORARIO_ATENDIMENTO':
        case 'CHOQUE_HORARIO_CLINICO': {
            const atendimento = conflito.detalhes?.atendimento_nome || conflito.detalhes?.conflito_com || 'Atendimento Clínico';
            const horario = conflito.detalhes?.horario ? ` às ${conflito.detalhes.horario}` : '';
            return `${prefixoOficina}Possui choque de horário com o atendimento de saúde (${atendimento})${horario}.`;
        }

        default:
            return conflito.mensagem || `${prefixoOficina}Conflito identificado na solicitação.`;
    }
}