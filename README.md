# elo-escolar
Sistema de gestão escolar para a APAE - Estância Velha

## Agenda semanal do aluno

`GET /api/alunos/:id/agenda` retorna a semana atual da instituição, de segunda a domingo,
considerando o fuso `America/Sao_Paulo`. Para consultar outra semana, informe qualquer data
dela: `GET /api/alunos/1/agenda?data=2026-11-04`.

O endpoint retorna um objeto com o período e os eventos (substituindo o antigo array):

```json
{
  "semana_inicio": "2026-11-02",
  "semana_fim": "2026-11-08",
  "eventos": []
}
```

Cada evento contém `id`, `tipo` (`REGULAR`, `OFICINA` ou `ATENDIMENTO`), `titulo`,
`data` (`AAAA-MM-DD`), `dia_semana` (segunda = 1, domingo = 7), `hora_inicio`,
`hora_fim`, `profissional` e `ambiente`. Eventos escolares também identificam a matrícula
e a turma; eventos clínicos identificam o atendimento e a sessão.

Os horários usam `HH:mm`, sem conversão de fuso dos valores civis persistidos. Eventos que
atravessam meia-noite são divididos por dia e recortados à semana consultada; `24:00`
representa o término no fim do dia. Matrículas respeitam suas datas de início e fim,
inclusive. Inscrições encerradas em oficinas continuam visíveis dentro de seu período de
vigência. Turmas, atendimentos e sessões inativos são excluídos; a consulta não reconstrói
alterações históricas de horários ou dados das turmas.

O calendário permite escolher uma data, avançar ou voltar uma semana e retornar à semana
atual. A turma regular e as inscrições em oficinas são consultadas independentemente da
semana exibida.

Para executar os testes do backend: `cd backend` e `npm test`.

## Cancelamento de inscrição em oficina

`PATCH /api/matriculas/oficinas/:matricula_id/cancelamento`, com corpo
`{ "aluno_id": 1 }`, encerra somente a inscrição indicada, desde que pertença ao aluno
e seja de uma oficina. O cancelamento retorna `200` com `mensagem` e `matricula`.

A inscrição é preservada com status `INATIVO` e `data_fim` igual a ontem, considerando
`America/Sao_Paulo`. Hoje e os dias seguintes deixam de aparecer na agenda e de ocupar
vaga; as atividades anteriores permanecem até o fim da vigência. Eventos noturnos são
recortados nesse limite. Repetir o cancelamento não modifica a data já registrada.
Inscrições feitas e canceladas no mesmo dia possuem período vazio e não geram histórico.
Uma reinscrição cria outro vínculo, mantendo o anterior intacto. A agenda registra o
período da inscrição, não uma confirmação de presença.

## Criação de atendimento clínico

O modal envia os dados para `POST /api/atendimentos` e atualiza a listagem e a agenda
após a criação. Atendimentos pontuais usam `EVENTUAL`; recorrências `SEMANAL` e `MENSAL`
exigem frequência inteira positiva e data de término. A recorrência semanal também exige
dias da semana numéricos. Erros e conflitos são apresentados no modal, preservando o formulário.
O início informado não pode estar no passado, considerando a data e a hora juntas em
`America/Sao_Paulo`, inclusive para recorrências. Como o formulário usa precisão de minutos,
um minuto que já começou não pode ser escolhido. A API revalida o início antes de gravar.

`GET /api/atendimentos/profissionais` retorna os funcionários com pessoa ativa no formato
`{ id, nome, cargo }`, ordenados por nome. A seleção não filtra especialidade por modalidade,
pois esse relacionamento não existe no modelo atual.

## Listagem de atendimentos do aluno

`GET /api/alunos/:id/atendimentos` retorna somente atendimentos ativos e vigentes,
considerando a data atual em `America/Sao_Paulo`. Pontuais continuam visíveis durante
todo o dia agendado e deixam a lista no dia seguinte. Recorrentes permanecem até a
data de término, inclusive, independentemente da data da última sessão. Registros
antigos de recorrências sem término continuam visíveis enquanto ativos.

A tela atualiza os dados na virada do dia e verifica a mudança de data ao retomar o
foco ou a visibilidade. A lista e seus contadores usam a mesma resposta da API.
Os registros e as sessões são preservados para consulta na agenda de semanas anteriores.
