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
  ambiente_id: z.number().int().positive(),
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

const getTurmaDTO = z.object({
  id: z.coerce.number().int().positive('O ID da turma deve ser um número positivo.').max(2147483647)
});

const editarTurmaDTO = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da turma.'),
  turno: z.enum(['MANHA', 'TARDE']),
  ano_letivo: z.number().int().positive(),
  ambiente_id: z.number().int().positive(),
  capacidade_maxima: z.number().int().nonnegative().nullable(),
  descricao: z.string().trim().nullable(),
  profissional_id: z.number().int().positive(),
  hora_inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  hora_fim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  dias_semana: z.array(z.number().int().min(1).max(5)).nonempty(),
  status: z.enum(['ATIVO', 'INATIVO']),
}).partial().strict().superRefine((dados, contexto) => {
  const campos = Object.keys(dados).filter((campo) => dados[campo] !== undefined);
  if (!campos.length) contexto.addIssue({ code: 'custom', message: 'Informe ao menos um campo para atualizar.' });
  if (campos.some((campo) => campo !== 'status') && dados.ambiente_id === undefined) {
    contexto.addIssue({ code: 'custom', path: ['ambiente_id'], message: 'Selecione a sala da turma.' });
  }
});

module.exports = { listarTurmasQueryDTO, listarTurmasRegularesQueryDTO, criarTurmaDTO, getTurmaDTO, editarTurmaDTO };
