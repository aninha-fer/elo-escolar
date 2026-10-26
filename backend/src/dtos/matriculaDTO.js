const { z } = require('zod');

const matricularOficinasDTO = z.object({
  aluno_id: z.number().int().positive("ID do aluno inválido."),
  oficinas_ids: z.array(z.number().int().positive()).nonempty("Selecione ao menos uma oficina para matrícula.")
});

const cancelarOficinaParamsDTO = z.object({
  matricula_id: z.coerce.number().int().positive('ID da inscrição inválido.')
});

const cancelarOficinaDTO = z.object({
  aluno_id: z.number().int().positive('ID do aluno inválido.')
});

module.exports = { matricularOficinasDTO, cancelarOficinaParamsDTO, cancelarOficinaDTO };
