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
    cargo: z.string({ required_error: "Cargo é obrigatório" }).trim().pipe(
        z.enum(['Professor', 'Clínico', 'Auxiliar', 'Outro'], { error: 'Selecione Professor, Clínico, Auxiliar ou Outro.' })
    )
});

const editarProfissionalDTO = criarProfissionalBaseDTO.pick({ nome: true, cargo: true }).extend({
    telefone: z.preprocess(
        (valor) => typeof valor === 'string' ? valor.trim() || null : valor,
        z.string().regex(/^\d{10,11}$/, 'O telefone deve conter apenas 10 ou 11 dígitos, incluindo o DDD.').nullable()
    ),
    status_geral: z.enum(['ATIVO', 'INATIVO']),
}).partial().strict().refine(
    (dados) => Object.values(dados).some((valor) => valor !== undefined),
    { message: 'Informe ao menos um campo para atualizar.' }
);

const editarProfissionalParamsDTO = z.object({
    id: z.coerce.number().int().min(1).max(2147483647),
});

module.exports = {
    criarProfissionalDTO: criarProfissionalBaseDTO,
    editarProfissionalDTO,
    editarProfissionalParamsDTO,
};
