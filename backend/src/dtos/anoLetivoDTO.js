const { z } = require('zod');

const dataDTO = z.iso.date('Informe uma data válida.');
const campos = {
  ano: z.number().int().min(1).max(9999),
  data_inicio: dataDTO,
  data_fim: dataDTO,
};
const criarAnoLetivoDTO = z.object(campos).strict();
const editarAnoLetivoDTO = z.object({ ...campos, confirmar_alteracao_fim: z.string().optional() }).partial().strict()
  .refine((dados) => Object.keys(campos).some((campo) => dados[campo] !== undefined), 'Informe os dados para atualizar.');
const anoLetivoParamsDTO = z.object({ id: z.coerce.number().int().positive().max(2147483647) });

module.exports = { criarAnoLetivoDTO, editarAnoLetivoDTO, anoLetivoParamsDTO };
