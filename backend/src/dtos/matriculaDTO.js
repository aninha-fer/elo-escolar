const { z } = require('zod');

const matricularOficinasDTO = z.object({
  aluno_id: z.number().int().positive("ID do aluno inválido."),
  oficinas_ids: z.array(z.number().int().positive()).nonempty("Selecione ao menos uma oficina para matrícula.")
});

module.exports = { matricularOficinasDTO };