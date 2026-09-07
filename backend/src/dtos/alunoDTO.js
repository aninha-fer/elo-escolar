const { z } = require('zod');

const textoOpcional = z.preprocess(
  (valor) => valor === '' || valor === null ? undefined : valor,
  z.string().optional()
);
const telefoneOpcional = z.preprocess(
  (valor) => valor === '' || valor === null ? undefined : valor,
  z.string()
    .min(10, "O telefone deve ter no mínimo 10 dígitos (com DDD)")
    .max(11, "O telefone deve ter no máximo 11 dígitos")
    .optional()
);
const criarAlunoBaseDTO = z.object({
  nome: z.string({ required_error: "Nome é obrigatório" }).min(2, "Nome muito curto"),
  telefone: telefoneOpcional,
  data_nascimento: z.preprocess((valor) => valor === '' || valor === null ? undefined : valor, z.string().refine((valor) => !Number.isNaN(Date.parse(valor)), 'Data de nascimento inválida').optional()),
  nome_responsavel: textoOpcional,
  telefone_responsavel: telefoneOpcional,
  turno: z.preprocess(
    (valor) => valor === 'MANHÃ' ? 'MANHA' : valor,
    z.enum(['MANHA', 'TARDE'], { required_error: "Turno deve ser MANHA ou TARDE" })
  ),
  dias_frequencia: z.preprocess(
    (valor) => Array.isArray(valor) ? valor.map(Number) : valor,
    z.array(z.number().int().min(1).max(7)).nonempty("É necessário informar ao menos um dia de frequência")
  ),
  participa_almoco: z.boolean().optional(),
  status: z.enum(['RASCUNHO', 'ATIVO', 'INATIVO']).default('RASCUNHO'),
  turma_id: z.number().int().positive().optional()
});
const criarAlunoDTO = criarAlunoBaseDTO.refine(
  (dados) => {
    if (dados.status === 'ATIVO' && !dados.turma_id) {
      return false;
    }
    return true;
  },
  {
    message: "A seleção de uma turma regular é obrigatória para salvar um aluno como ATIVO.",
    path: ["turma_id"]
  }
);

const getAlunoDTO = z.object({
  id: z.coerce.number().int().positive("O ID do aluno deve ser um número positivo.")
});

const getAgendaAlunoDTO = z.object({
  id: z.coerce.number().int().positive("O ID do aluno deve ser um número positivo.")
});

module.exports = { criarAlunoDTO, getAgendaAlunoDTO, getAlunoDTO };