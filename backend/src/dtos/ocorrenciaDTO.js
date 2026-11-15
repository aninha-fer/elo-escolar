const { z } = require('zod');

const id = z.coerce.number().int().min(1).max(2147483647);
const campos = z.object({
    resumo: z.string().trim().min(1, 'Informe o resumo.').max(200, 'O resumo deve ter no máximo 200 caracteres.'),
    descricao: z.string().trim().min(1, 'Informe a descrição.'),
    data: z.iso.date({ error: 'Informe uma data válida.' }),
    hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe um horário válido.'),
});

module.exports = {
    criarOcorrenciaDTO: campos.strict(),
    editarOcorrenciaDTO: campos.partial().strict().refine(
        (dados) => Object.keys(dados).length > 0,
        { message: 'Informe ao menos um campo para atualizar.' }
    ),
    alunoParamsDTO: z.object({ aluno_id: id }),
    ocorrenciaParamsDTO: z.object({ aluno_id: id, ocorrencia_id: id }),
};
