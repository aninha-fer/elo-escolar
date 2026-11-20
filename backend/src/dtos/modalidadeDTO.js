const { z } = require('zod');

const criarModalidadeDTO = z.strictObject({
    nome: z.string().trim().min(1, 'Informe o nome da modalidade.').max(200, 'O nome deve ter no máximo 200 caracteres.'),
});

module.exports = { criarModalidadeDTO };
