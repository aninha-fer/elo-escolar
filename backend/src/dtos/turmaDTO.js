const { z } = require('zod');

const listarTurmasQueryDTO = z.object({
  tipo: z.enum(['REGULAR', 'OFICINA'], {
    invalid_type_error: "O tipo deve ser REGULAR ou OFICINA."
  }).optional()
});

module.exports = { listarTurmasQueryDTO };