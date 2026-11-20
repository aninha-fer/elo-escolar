const { z } = require('zod');

const paginacaoDTO = z.object({
  paginado: z.enum(['true', 'false']),
  cursor: z.string().min(1).max(4000).optional(),
  busca: z.string().trim().max(200).default(''),
  status: z.enum(['TODOS', 'ATIVO', 'INATIVO', 'RASCUNHO']).default('TODOS'),
  tipo: z.enum(['REGULAR', 'OFICINA']).optional(),
});

const cursorDTO = z.object({ chave: z.string().max(1000), id: z.number().int().positive().max(2147483647), assinatura: z.string() }).strict();

function lerPaginacao(query = {}) {
  if (query.paginado === undefined) return null;
  const dados = paginacaoDTO.parse(query);
  return dados.paginado === 'true' ? dados : null;
}

module.exports = { lerPaginacao, cursorDTO };
