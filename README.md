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

Na recorrência mensal, a data inicial deve ser de segunda a sexta-feira. As próximas
ocorrências mantêm o dia original como referência a cada intervalo de meses. Em meses
mais curtos, usa-se o último dia do mês; se a ocorrência cair no sábado ou domingo,
ela é antecipada para a sexta-feira anterior, inclusive quando essa sexta pertence ao
mês anterior. O limite de término, inclusivo, é aplicado sobre a data ajustada.
Frequência do aluno e conflitos são validados nas datas efetivamente agendadas.
A regra vale para novas criações; as sessões já gravadas mantêm suas datas.

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

## Planejamento de alunos em rascunho

Alunos `RASCUNHO` podem ter turma regular, inscrições em oficinas e atendimentos
eventuais, semanais ou mensais. O backend determina o status dos vínculos a partir
do aluno: `PROVISORIO` para rascunhos e `ATIVO` para alunos ativos. A pessoa do
rascunho permanece `INATIVO`. Alunos inativos não recebem novos vínculos.

O planejamento usa as mesmas tabelas e validações de frequência, turno das turmas,
duplicidade e conflitos da agenda. Atendimentos clínicos mantêm a regra atual de
turno e não exigem turma regular. A turma regular pode sobrepor oficinas e clínica.
As regras de recorrência e de bloqueio de horários passados continuam em vigor.

Matrículas provisórias não ocupam vagas, inclusive quando a turma ou oficina já
está lotada. As contagens continuam considerando somente `ATIVO`. Capacidade
`null` significa sem limite, com `vagas_disponiveis: null`; capacidade `0` impede
matrículas efetivas. Operações que ocupam vagas bloqueiam as turmas envolvidas
para evitar que alunos distintos ocupem simultaneamente a última vaga.

A turma regular pode ser escolhida ao salvar o cadastro como rascunho. A API
também oferece `POST /api/matriculas/regular` com `{ "aluno_id": 1, "turma_id": 2 }`.
A resposta dos detalhes do aluno inclui `matricula_regular` com `id` e `status`.
O calendário identifica o planejamento com texto `Provisório` e borda tracejada,
mantendo a grade e os controles existentes da Visão Geral.

As remoções de planejamento são separadas do cancelamento efetivo:

- `DELETE /api/alunos/:aluno_id/matriculas/:matricula_id/provisorio` remove apenas a matrícula provisória indicada.
- `DELETE /api/alunos/:aluno_id/atendimentos/:atendimento_id/provisorio` remove o atendimento provisório inteiro e todas as suas sessões, em uma transação.

Essas operações exigem vínculo pertencente ao rascunho e status `PROVISORIO`.
Atendimentos com sessões efetivas não podem ser removidos por esse fluxo.
O cancelamento efetivo de oficinas preserva sua vigência e histórico e rejeita
vínculos provisórios. As confirmações da interface distinguem os dois casos.

Ativação e tratamento específico de planejamento vencido não fazem parte desta
entrega; as listagens mantêm os filtros de vigência existentes. A migration
`20261028000000_status_provisorio` adiciona o valor ao enum compartilhado, sem
alterar o status ou as datas de registros já existentes.
