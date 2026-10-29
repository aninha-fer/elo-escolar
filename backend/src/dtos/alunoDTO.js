const { z } = require('zod');

const textoOpcional = z.preprocess(
  (valor) => typeof valor === 'string' ? valor.trim() || undefined : valor === null ? undefined : valor,
  z.string().optional()
);
const telefoneOpcional = z.preprocess(
  (valor) => typeof valor === 'string' ? valor.trim() || undefined : valor === null ? undefined : valor,
  z.string()
    .min(10, "O telefone deve ter no mínimo 10 dígitos (com DDD)")
    .max(11, "O telefone deve ter no máximo 11 dígitos")
    .regex(/^\d{10,11}$/, 'O telefone deve conter apenas 10 ou 11 dígitos, incluindo o DDD.')
    .optional()
);

const responsavelDTO = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do responsável.'),
  telefone: telefoneOpcional,
  parentesco: z.preprocess(
    (valor) => typeof valor === 'string' ? valor.trim() || undefined : valor === null ? undefined : valor,
    z.string().max(30, 'O parentesco deve ter no máximo 30 caracteres.').optional()
  )
});

const dadosMedicosDTO = z.object({
  restricao_alimentar: textoOpcional,
  autorizado_atividade_fisica: z.boolean().nullable().optional(),
  usa_medicamento: z.boolean().nullable().optional(),
  medicamentos_descricao: textoOpcional,
  autorizacao_analgesico: z.enum(['NENHUM', 'PARACETAMOL', 'DIPIRONA', 'AMBOS']).nullable().optional()
}).superRefine((dados, contexto) => {
  if (dados.usa_medicamento === true && !dados.medicamentos_descricao) {
    contexto.addIssue({ code: 'custom', path: ['medicamentos_descricao'], message: 'Informe qual medicamento o aluno utiliza.' });
  }
}).transform((dados) => ({
  restricao_alimentar: dados.restricao_alimentar ?? null,
  autorizado_atividade_fisica: dados.autorizado_atividade_fisica ?? null,
  usa_medicamento: dados.usa_medicamento ?? null,
  medicamentos_descricao: dados.usa_medicamento === true ? dados.medicamentos_descricao : null,
  autorizacao_analgesico: dados.autorizacao_analgesico ?? null
}));
const criarAlunoBaseDTO = z.object({
  nome: z.string({ required_error: "Nome é obrigatório" }).min(2, "Nome muito curto"),
  telefone: telefoneOpcional,
  data_nascimento: z.preprocess((valor) => valor === '' || valor === null ? undefined : valor, z.string().refine((valor) => !Number.isNaN(Date.parse(valor)), 'Data de nascimento inválida').optional()),
  responsaveis: z.array(responsavelDTO).default([]),
  participa_procan: z.boolean().default(false),
  observacoes: textoOpcional,
  dados_medicos: dadosMedicosDTO.nullable().optional(),
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

const getAgendaQueryDTO = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'A data deve estar no formato AAAA-MM-DD.')
    .refine((valor) => {
      const data = new Date(`${valor}T00:00:00.000Z`);
      return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
    }, 'Data inválida.').optional()
});

module.exports = { criarAlunoDTO, getAgendaAlunoDTO, getAgendaQueryDTO, getAlunoDTO };
