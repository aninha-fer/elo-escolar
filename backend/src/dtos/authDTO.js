const { z } = require('zod');

const loginDTO = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  senha: z.string().min(1).max(100),
});

const trocarSenhaInicialDTO = z.strictObject({
  nova_senha: z.string().min(8, 'A senha deve ter entre 8 e 100 caracteres.').max(100, 'A senha deve ter entre 8 e 100 caracteres.').regex(/[A-Z]/, 'Inclua uma letra maiúscula.').regex(/[a-z]/, 'Inclua uma letra minúscula.').regex(/[0-9]/, 'Inclua um número.'),
  confirmacao_senha: z.string().min(1, 'Confirme a nova senha.').max(100, 'A confirmação deve ter no máximo 100 caracteres.'),
}).refine((dados) => dados.nova_senha === dados.confirmacao_senha, {
  path: ['confirmacao_senha'], message: 'A confirmação deve ser igual à nova senha.',
});

module.exports = { loginDTO, trocarSenhaInicialDTO };
