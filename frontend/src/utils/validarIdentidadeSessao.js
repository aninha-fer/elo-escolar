import { z } from 'zod';

const identidade = z.object({
    id: z.number().int().positive(),
    nome: z.string(),
    email: z.string().email(),
    role: z.enum(['admin', 'professor']),
    deve_trocar_senha: z.boolean(),
});

export function validarIdentidadeSessao(dados) {
    const resultado = identidade.safeParse(dados);
    if (!resultado.success) {
        throw Object.assign(new Error('O servidor retornou uma resposta inesperada.'), { code: 'RESPOSTA_INVALIDA' });
    }
    return resultado.data;
}
