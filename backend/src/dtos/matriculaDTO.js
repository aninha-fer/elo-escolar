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

const matricularRegularDTO = z.object({
  aluno_id: z.number().int().positive('ID do aluno inválido.'),
  turma_id: z.number().int().positive('ID da turma inválido.')
});

const removerMatriculaProvisoriaDTO = z.object({
  aluno_id: z.coerce.number().int().positive('ID do aluno inválido.'),
  matricula_id: z.coerce.number().int().positive('ID da matrícula inválido.')
});

module.exports = { matricularOficinasDTO, cancelarOficinaParamsDTO, cancelarOficinaDTO,
  matricularRegularDTO, removerMatriculaProvisoriaDTO };
