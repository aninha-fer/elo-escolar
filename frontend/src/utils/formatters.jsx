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
  if (!conflito || !conflito.codigo) return 'Conflito não identificado.';

  switch (conflito.codigo) {
    case 'TURNO_INCOMPATIVEL':
      return `A oficina ${conflito.oficina_nome} é realizada no turno da ${formatarTurno(conflito.detalhes.turno_oficina)}, incompatível com o turno da ${formatarTurno(conflito.detalhes.turno_aluno)} do aluno.`;

    case 'FREQUENCIA_INSUFICIENTE':
      return `A oficina ${conflito.oficina_nome} exige presença em dias em que o aluno não possui frequência registrada: ${conflito.detalhes.dias_faltantes}.`;

    case 'CHOQUE_HORARIO_ATENDIMENTO':
      return `A oficina ${conflito.oficina_nome} possui choque de horário com o atendimento clínico (${conflito.detalhes.atendimento_nome}) às ${conflito.detalhes.horario}.`;

    default:
      return `Conflito detectado na oficina ${conflito.oficina_nome || ''}.`;
  }
}