const { z } = require('zod');

const dadosConta = {
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  role: z.enum(['admin', 'professor']),
  senha: z.string().min(8).max(100),
};

const criarUsuarioDTO = z.discriminatedUnion('modo', [
  z.strictObject({
    ...dadosConta,
    modo: z.literal('existente'),
    pessoa_id: z.number().int().min(1).max(2147483647),
  }),
  z.strictObject({
    ...dadosConta,
    modo: z.literal('nova'),
    pessoa: z.strictObject({
      nome: z.string().trim().min(1).max(200),
    }),
  }),
]);

const editarUsuarioDTO = z.object({
  ...dadosConta,
  status: z.enum(['ATIVO', 'INATIVO']),
  pessoa: z.strictObject({
    nome: z.string().trim().min(1).max(200),
  }).partial()
}).partial().strict().refine(
  (dados) => dados.email !== undefined || dados.role !== undefined || dados.senha !== undefined ||
    dados.status !== undefined || dados.pessoa?.nome !== undefined,
  { message: "Informe ao menos um campo para atualizar" }
);

const editarUsuarioParamsDTO = z.object({
  id: z.coerce.number().int().min(1).max(2147483647),
});

module.exports = { criarUsuarioDTO, editarUsuarioDTO, editarUsuarioParamsDTO };
