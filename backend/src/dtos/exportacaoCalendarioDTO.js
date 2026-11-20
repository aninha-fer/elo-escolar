const { z } = require('zod');

const filtrosExportacaoDTO = z.object({
    busca: z.string().trim().max(200).default(''),
    status: z.enum(['TODOS', 'ATIVO', 'INATIVO', 'RASCUNHO']).default('TODOS'),
});
const loteExportacaoDTO = z.object({
    ids: z.string().max(240).transform((valor) => valor.split(',').map(Number))
        .pipe(z.array(z.number().int().positive().max(2147483647)).min(1).max(20))
        .refine((ids) => new Set(ids).size === ids.length, 'Não repita alunos no lote.'),
    referencia: z.string().datetime(),
});

module.exports = { filtrosExportacaoDTO, loteExportacaoDTO };
