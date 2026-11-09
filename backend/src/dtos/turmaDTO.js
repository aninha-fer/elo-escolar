const { z } = require('zod');

const listarTurmasQueryDTO = z.object({
  tipo: z.enum(['REGULAR', 'OFICINA'], {
    invalid_type_error: "O tipo deve ser REGULAR ou OFICINA."
  }).optional()
});

const listarTurmasRegularesQueryDTO = z.object({
  turno: z.enum(['MANHA', 'TARDE'], {
    invalid_type_error: "O turno deve ser MANHA ou TARDE."
  }).optional()
});

const inteiroOpcional = (schema) => z.preprocess(
  (valor) => valor === '' || valor === null ? undefined : valor,
  schema.optional()
);

const criarTurmaDTO = z.object({
  tipo: z.enum(['REGULAR', 'OFICINA']),
  nome: z.string().trim().min(1, 'Informe o nome da turma.'),
  turno: z.enum(['MANHA', 'TARDE']),
  ambiente_id: inteiroOpcional(z.number().int().positive()),
  capacidade_maxima: inteiroOpcional(z.number().int().nonnegative()),
  ano_letivo: inteiroOpcional(z.number().int().positive()),
  descricao: z.string().trim().nullish(),
  profissional_id: z.number().int().positive(),
  hora_inicio: z.string().optional(),
  hora_fim: z.string().optional(),
  dias_semana: z.array(z.number().int().min(1).max(7)).default([])
}).superRefine((dados, contexto) => {
  const erro = (campo, message) => contexto.addIssue({ code: 'custom', path: [campo], message });
  if (dados.tipo === 'REGULAR') {
    if (dados.ano_letivo === undefined) erro('ano_letivo', 'Informe o ano letivo da turma regular.');
    return;
  }

  const faixas = dados.turno === 'MANHA'
    ? [['08:15', '09:15'], ['09:45', '11:00']]
    : [['13:30', '14:45'], ['15:15', '16:30']];
  if (!faixas.some(([inicio, fim]) => dados.hora_inicio === inicio && dados.hora_fim === fim)) {
    erro('hora_inicio', 'Selecione uma faixa de horário válida para o turno da oficina.');
  }
  if (dados.dias_semana.length === 0) erro('dias_semana', 'Selecione ao menos um dia da semana da oficina.');
});

module.exports = { listarTurmasQueryDTO, listarTurmasRegularesQueryDTO, criarTurmaDTO };
