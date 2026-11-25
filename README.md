# elo-escolar
Sistema de gestão escolar para a APAE - Estância Velha

## Equipe de turmas e oficinas

Cadastro, edição e criação a partir de outra turma recebem `profissionais_ids`, uma
lista não vazia de IDs de funcionários, sem duplicações. Novos vínculos exigem
profissionais ativos, não excluídos, com cargo Professor ou Auxiliar. Não existe
responsável principal. Alterar o cargo do profissional continua permitido e não
remove seus vínculos existentes.

As respostas de turmas retornam `profissionais`, com `id`, `cargo`, `pessoa.nome`,
`status_geral` e `excluido`. O detalhe também retorna `historico_profissionais`,
com o ID do vínculo, profissional e datas `data_inicio`/`data_fim`. No PATCH,
omitir `profissionais_ids` preserva a equipe; informá-lo substitui a seleção
completa. Adições e encerramentos são gravados na mesma transação da turma.

`turma_profissional` preserva os períodos de atuação. A vigência é diária, no
fuso da instituição: inclusão começa hoje e retirada encerra em ontem, inclusive.
Inclusão e retirada no mesmo dia produzem período vazio, preservado no histórico.
O retorno cria outro vínculo. Inativar/excluir a turma preserva sua equipe;
reativar exige revalidar todos os responsáveis. Inativar/excluir um profissional
continua bloqueado enquanto ele integrar qualquer turma ativa, mesmo com outros
responsáveis, além das restrições clínicas existentes.

A migration `20261123000000_multiplos_profissionais_turma` transfere os vínculos
atuais, inclusive de turmas inativas ou excluídas, antes de remover a coluna
singular. O início dos vínculos migrados permanece desconhecido (`null`). Um
índice único parcial impede dois vínculos abertos do mesmo profissional na turma.
A agenda semanal usa os responsáveis vigentes em cada dia; os nomes e cargos
continuam sendo os dados atuais do profissional. O PDF do calendário apresenta
a equipe atual. Os atendimentos clínicos mantêm seu responsável individual.

Após atualizar o código, aplique as migrations com `npx prisma migrate deploy`
e gere o cliente com `npx prisma generate`, em `backend`, reiniciando a API.
Não execute o seed para migrar dados existentes.

O teste de transferência dos vínculos e integridade referencial usa um schema
isolado em transação com rollback, sem alterar dados existentes. Em `backend`:

```powershell
$env:TESTAR_VINCULOS_POSTGRES = '1'
node --test src/services/turmaProfissionalService.test.js
Remove-Item Env:TESTAR_VINCULOS_POSTGRES
```

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

`GET /api/profissionais` é a listagem oficial compartilhada pela gestão de profissionais
e pelo cadastro de atendimentos. Retorna `{ id, nome, telefone, funcao, status_geral }`,
ordenados por nome, incluindo ativos e inativos. O formulário de atendimento oferece
somente os registros com `status_geral: 'ATIVO'`, usando o ID do funcionário e a função
no rótulo. A seleção não filtra especialidade por modalidade, pois esse relacionamento
não existe no modelo atual. O acesso à listagem exige perfil de administrador.

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

A turma regular pode ser escolhida no cadastro ou na edição do aluno em rascunho,
preservando a matrícula provisória e suas validações. Na tela da turma, o modal
"Vincular Aluno" oferece somente alunos ativos sem turma regular vigente.
`POST /api/matriculas/regular`, com `{ "aluno_id": 1, "turma_id": 2 }`, exige aluno
ativo e revalida o status sob bloqueio dentro da transação; rascunhos recebem 409
sem criar matrícula. Essa restrição é definida pelo servidor para esse endpoint
e não altera as matrículas provisórias nos demais fluxos.
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

## Responsáveis, Procan e dados médicos

O cadastro (`POST /api/alunos`) aceita `responsaveis`, uma lista opcional de
`{ nome, telefone, parentesco }`. Cada responsável é uma pessoa independente
vinculada ao aluno por `aluno_responsavel`; parentesco é opcional e limitado a
30 caracteres. Nome é obrigatório quando um responsável é informado. Telefone
é opcional e deve conter 10 ou 11 dígitos, incluindo DDD. A interface permite
adicionar e remover responsáveis antes de salvar e pesquisa pelo nome de qualquer
responsável. A tabela mostra o primeiro nome cadastrado e a quantidade dos demais.

`participa_procan` é booleano, com padrão `false`, e `observacoes` é texto opcional.
O objeto opcional `dados_medicos` contém:

- `restricao_alimentar`: texto opcional;
- `autorizado_atividade_fisica`: `true`, `false` ou `null`;
- `usa_medicamento`: `true`, `false` ou `null`;
- `medicamentos_descricao`: texto obrigatório quando `usa_medicamento` for `true`;
- `autorizacao_analgesico`: `NENHUM`, `PARACETAMOL`, `DIPIRONA`, `AMBOS` ou `null`.

`null` significa não informado. `false` e `NENHUM` são respostas explícitas e
não são substituídos por `null`. Selecionar "Não" no uso de medicamento limpa sua
descrição. Se todos os dados médicos estiverem vazios, o cadastro não cria o
registro médico. Pessoa do aluno, aluno, responsáveis, dados médicos e eventual
matrícula são gravados na mesma transação.

`GET /api/alunos` retorna Procan e o resumo dos responsáveis, sem dados médicos,
observações ou telefones de responsáveis. `GET /api/alunos/:id` retorna todos os
responsáveis com telefone e parentesco e os dados médicos para os cartões da
Visão Geral. Não há novas rotas ou fluxo de edição nesta entrega.

A migration `20261028010000_dados_complementares_aluno` cria as novas estruturas
e remove `nome_responsavel` e `telefone_responsavel` sem transferir os dados
fictícios antigos. Os timestamps novos seguem o padrão existente (`DateTime`,
`created_at` com `@default(now())` e `updated_at` com `@updatedAt`). A tabela de
ocorrências não faz parte desta entrega.

## Expiração da sessão

A sessão expira após 60 minutos sem atividade reconhecida pelo servidor, com
limite absoluto de oito horas. Login e troca inicial de senha iniciam ambos os
prazos. Sessões antigas sem `ultimaAtividadeEm` exigem novo login após a atualização;
não há alteração no schema do banco.

O frontend registra interações reais em documentos visíveis, no máximo uma vez
por minuto por aba, em `POST /api/auth/atividade`. Consultas automáticas e a
verificação periódica de `/api/auth/me` não renovam a atividade. Abas compartilham
a sessão pelo cookie; nenhuma aba encerra a sessão apenas pelo próprio relógio.
A retomada verifica o servidor antes de renovar, e sinais pendentes de atividade
são descartados após 60 segundos.

Os testes de sessão e conexão usam relógio controlado. Em `backend`, `npm test`
inclui os testes HTTP de expiração e concorrência com logout. Para executar também
o teste de atualização atômica no PostgreSQL configurado no `.env`, use no PowerShell:

```powershell
$env:TESTAR_SESSAO_POSTGRES = '1'
node --test src/services/sessaoService.test.js
Remove-Item Env:TESTAR_SESSAO_POSTGRES
```

Esse teste usa somente tabelas temporárias, removidas ao final da transação,
sem modificar registros do sistema. Em `frontend`, execute os testes do monitor
e da conexão com `node --test src/services/*.test.js`.

## Vigência das matrículas

Matrículas `ATIVO` com `data_fim` anterior ao dia atual em `America/Sao_Paulo`
não ocupam vagas, não aparecem nos vínculos atuais e não impedem novas matrículas,
troca de turno, redução de frequência ou ativação de rascunhos. O término é inclusivo:
uma matrícula com término hoje permanece vigente até a virada do dia. Matrículas
com início futuro continuam reservando vagas. Provisórias só participam do planejamento
enquanto não possuem `data_fim`, sem ocupar vagas efetivas.

O critério vale também para paginação, candidatos a nova turma, capacidade e diário.
A reinscrição cria outro registro; a agenda histórica preserva a matrícula anterior.
No encerramento da turma, vencidas não entram na confirmação de cancelamentos e
suas datas anteriores são preservadas. A sincronização de turmas regulares cujo ano
letivo terminou continua sob demanda.

O teste de paginação no PostgreSQL usa tabelas temporárias, sem alterar os registros
do sistema. Para executá-lo em `backend`, com o banco configurado no `.env`:

```powershell
$env:TESTAR_MATRICULAS_POSTGRES = '1'
node --test src/services/paginacaoService.test.js
Remove-Item Env:TESTAR_MATRICULAS_POSTGRES
```
