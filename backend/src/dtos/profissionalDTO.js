const { z } = require('zod');

const telefoneOpcional = z.preprocess(
  (valor) => typeof valor === 'string' ? valor.trim() || undefined : valor === null ? undefined : valor,
  z.string()
    .min(10, "O telefone deve ter no mínimo 10 dígitos (com DDD)")
    .max(11, "O telefone deve ter no máximo 11 dígitos")
    .regex(/^\d{10,11}$/, 'O telefone deve conter apenas 10 ou 11 dígitos, incluindo o DDD.')
    .optional()
);

const criarProfissionalBaseDTO = z.object({
    nome: z.string({ required_error: "Nome é obrigatório" }).trim().min(2, "Nome muito curto"),
    telefone: telefoneOpcional,
    email: z.preprocess(
        (valor) => typeof valor === 'string' ? valor.trim().toLowerCase() || undefined : valor === null ? undefined : valor,
        z.string().max(254).pipe(z.email()).optional()
    ),
    cargo: z.string({ required_error: "Cargo é obrigatório" }).trim().min(2, "Cargo muito curto")
});

module.exports = {
    criarProfissionalDTO: criarProfissionalBaseDTO
};
