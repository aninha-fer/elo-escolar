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

module.exports = { listarTurmasQueryDTO, listarTurmasRegularesQueryDTO };