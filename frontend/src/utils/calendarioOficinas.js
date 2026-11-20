export const DIAS_OFICINAS = [
    { numero: 1, nome: 'Segunda' }, { numero: 2, nome: 'Terça' },
    { numero: 3, nome: 'Quarta' }, { numero: 4, nome: 'Quinta' }, { numero: 5, nome: 'Sexta' },
];

export const CORES_OFICINAS = [
    { fundo: '#EFF6FF', borda: '#DBEAFE', texto: '#2563EB', classe: 'border-blue-100 bg-blue-50 text-blue-600' },
    { fundo: '#FFFBEB', borda: '#FDE68A', texto: '#B45309', classe: 'border-amber-200 bg-amber-50 text-amber-700' },
];

function hora(valor) {
    if (!valor) return '--:--';
    return valor.includes('T') ? valor.slice(11, 16) : valor.slice(0, 5);
}

export function agruparOficinasPorDia(oficinas) {
    return DIAS_OFICINAS.map((dia) => ({ ...dia, oficinas: oficinas.flatMap((oficina) =>
        (oficina.horarios ?? []).filter((horario) => horario.dia_semana === dia.numero).map((horario) => ({
            chave: `${oficina.id}-${horario.id ?? `${dia.numero}-${hora(horario.hora_inicio)}-${hora(horario.hora_fim)}`}`,
            id: oficina.id, nome: oficina.nome, sala: oficina.ambiente?.nome || 'Sala não informada',
            inicio: hora(horario.hora_inicio), fim: hora(horario.hora_fim), cor: oficina.turno === 'TARDE' ? 1 : 0,
        }))
    ).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.nome.localeCompare(b.nome, 'pt-BR') || a.id - b.id) }));
}
