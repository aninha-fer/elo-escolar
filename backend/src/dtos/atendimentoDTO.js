const { z } = require('zod');

const dataDTO = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'A data deve estar no formato AAAA-MM-DD.')
  .refine((data) => {
    const dataConvertida = new Date(`${data}T00:00:00.000Z`);
    return !Number.isNaN(dataConvertida.getTime()) &&
      dataConvertida.toISOString().slice(0, 10) === data;
  }, 'Data inválida.');

const inteiroPositivoDTO = z.preprocess(
  (valor) => valor === '' || valor === null ? undefined : Number(valor),
  z.number().int().positive()
);

const criarAtendimentoDTO = z.object({
  aluno_id: inteiroPositivoDTO,
  profissional_id: inteiroPositivoDTO,
  modalidade: z.string().trim().min(1, 'A modalidade é obrigatória.'),
  tipo_recorrencia: z.enum(['EVENTUAL', 'SEMANAL', 'MENSAL']),
  data_inicio: dataDTO,
  hora_inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'A hora deve estar no formato HH:mm.'),
  duracao_minutos: inteiroPositivoDTO,
  frequencia: inteiroPositivoDTO.optional(),
  dias_semana: z.preprocess(
    (valor) => Array.isArray(valor) ? valor.map(Number) : valor,
    z.array(z.number().int().min(1).max(7)).default([])
  ),
  data_termino: z.preprocess(
    (valor) => valor === '' || valor === null ? undefined : valor,
    dataDTO.optional()
  )
}).superRefine((dados, contexto) => {
  if (dados.tipo_recorrencia !== 'EVENTUAL') {
    if (!dados.frequencia) {
      contexto.addIssue({
        code: 'custom',
        path: ['frequencia'],
        message: 'A frequência é obrigatória para atendimentos recorrentes.'
      });
    }
    if (!dados.data_termino) {
      contexto.addIssue({
        code: 'custom',
        path: ['data_termino'],
        message: 'A data de término é obrigatória para atendimentos recorrentes.'
      });
    } else if (dados.data_termino < dados.data_inicio) {
      contexto.addIssue({
        code: 'custom',
        path: ['data_termino'],
        message: 'A data de término não pode ser anterior à data de início.'
      });
    }
  }

  if (dados.tipo_recorrencia === 'SEMANAL' && dados.dias_semana.length === 0) {
    contexto.addIssue({
      code: 'custom',
      path: ['dias_semana'],
      message: 'Selecione ao menos um dia da semana para a recorrência semanal.'
    });
  }
});

module.exports = { criarAtendimentoDTO };
