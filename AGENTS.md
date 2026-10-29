# Elo Escolar — Instruções para Agentes de Desenvolvimento

## 1. Visão geral do projeto

O **Elo Escolar** é um sistema de gestão escolar desenvolvido para a **APAE de Estância Velha**.

O objetivo principal do sistema é centralizar a gestão da rotina escolar dos alunos, substituindo controles manuais e planilhas por uma aplicação capaz de organizar:

- alunos;
- matrículas;
- turmas regulares;
- oficinas;
- profissionais;
- atendimentos clínicos;
- agendas;
- conflitos de horários;
- listas e diários de classe;
- usuários e permissões.

A principal regra de domínio do sistema é garantir que a agenda do aluno permaneça consistente.

O sistema deve impedir, alertar ou tratar conflitos envolvendo:

- turma regular;
- oficinas;
- atendimentos clínicos;
- dias de frequência do aluno;
- turno;
- capacidade de vagas;
- atividades simultâneas.

---

# 2. Estado do projeto: documentação x implementação

Existem duas fontes de contexto que devem ser consideradas durante qualquer desenvolvimento.

## 2.1 Documentação funcional

A documentação do Elo Escolar representa os **requisitos e comportamento esperado do produto**.

Ela deve ser considerada referência para:

- regras de negócio;
- requisitos funcionais;
- requisitos não funcionais;
- comportamento esperado das telas;
- fluxos do usuário;
- validações de agenda;
- regras de matrícula;
- permissões;
- evolução planejada do sistema.

## 2.2 Código existente

O código atual representa o **estado real da implementação**.

Nem todos os requisitos documentados estão implementados.

Antes de desenvolver qualquer funcionalidade:

1. analisar o código existente;
2. identificar o que já está implementado;
3. comparar com o requisito relacionado;
4. evitar assumir que a documentação já está refletida no código;
5. preservar comportamentos existentes que estejam corretos;
6. não implementar requisitos adicionais fora do escopo solicitado.

Quando houver divergência entre documentação e código:

- não alterar silenciosamente o comportamento existente;
- identificar a divergência;
- informar qual comportamento existe atualmente;
- informar qual comportamento está previsto na documentação;
- implementar apenas aquilo que fizer parte da tarefa solicitada.

---

# 3. Arquitetura atual

A aplicação possui três camadas principais:

```text
Frontend React
      ↓
HTTP / JSON / Axios
      ↓
API Express
      ↓
Controllers + validação Zod
      ↓
Services
      ↓
Prisma
      ↓
PostgreSQL
```

O frontend e o backend são aplicações independentes.

```text
elo-escolar/
├── AGENTS.md
│
├── backend/
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.js
│   │
│   └── src/
│       ├── server.js
│       ├── routes/
│       ├── controllers/
│       ├── dtos/
│       ├── services/
│       └── prismaClient.js
│
└── frontend/
    ├── package.json
    │
    └── src/
        ├── routes/
        ├── layouts/
        ├── pages/
        ├── components/
        ├── services/
        └── utils/
```

Não assumir que frontend e backend compartilham dependências ou comandos.

Ao executar comandos, identificar primeiro em qual projeto eles devem ser executados.

---

# 4. Stack tecnológica atual

## Frontend

O frontend utiliza:

- React 19;
- JavaScript;
- Vite;
- React Router;
- Axios;
- Tailwind CSS;
- ES Modules.

A variável de ambiente utilizada para definir a API é:

```text
VITE_API_URL
```

A aplicação atualmente utiliza estado local com:

```text
useState
useEffect
```

Não existe atualmente uma solução global de estado ou cache de requisições.

Não adicionar Redux, Zustand, React Query, Context global ou outra biblioteca de gerenciamento de estado sem necessidade explícita ou solicitação.

---

## Backend

O backend utiliza:

- Node.js;
- JavaScript;
- Express;
- Zod;
- Prisma;
- PostgreSQL;
- CommonJS.

A API é disponibilizada sob:

```text
/api
```

A porta padrão de desenvolvimento é:

```text
3333
```

Não converter o backend para TypeScript, ES Modules ou outro padrão estrutural sem solicitação explícita.

---

# 5. Responsabilidade das camadas

## 5.1 Routes

Responsáveis somente por:

- definir caminho HTTP;
- definir método HTTP;
- associar endpoint ao controller.

Exemplo conceitual:

```text
POST /api/alunos
        ↓
alunoController.create
```

Evitar regras de negócio nas rotas.

---

## 5.2 Controllers

Responsáveis por:

- receber a requisição HTTP;
- obter `params`, `query` e `body`;
- executar validações de entrada;
- chamar o service correspondente;
- definir status HTTP;
- devolver JSON.

Controllers não devem concentrar regras complexas de negócio.

Antes de adicionar validação diretamente a um controller, verificar se:

- ela pertence a um DTO/Zod;
- ela pertence ao domínio e deveria estar no service.

---

## 5.3 DTOs

Local:

```text
backend/src/dtos/
```

Os DTOs utilizam **Zod**.

Responsabilidades:

- validar estrutura dos dados;
- validar tipos;
- validar formatos;
- validar campos obrigatórios;
- validar valores permitidos.

Validações de regra de negócio que dependem do banco ou de outras entidades devem permanecer nos services.

Exemplo:

```text
email válido
```

é validação de entrada.

Já:

```text
não permitir matrícula se a oficina estiver lotada
```

é regra de negócio.

---

## 5.4 Services

Local:

```text
backend/src/services/
```

Os services concentram atualmente:

- regras de negócio;
- consultas ao Prisma;
- gravação no banco;
- validações que dependem do estado atual do sistema;
- transações.

A arquitetura atual **não possui camada Repository separada**.

Portanto:

**NÃO criar uma camada `repositories/` apenas por preferência arquitetural.**

Manter o padrão atual, salvo quando:

- a tarefa solicitar explicitamente essa refatoração; ou
- existir uma decisão arquitetural documentada para fazê-la.

---

## 5.5 Prisma

O acesso ao PostgreSQL deve ocorrer através do Prisma.

O schema principal encontra-se em:

```text
backend/prisma/schema.prisma
```

O cliente compartilhado encontra-se em:

```text
backend/src/prismaClient.js
```

Evitar criar múltiplas instâncias desnecessárias do `PrismaClient`.

Quando múltiplas alterações de banco fizerem parte da mesma operação de negócio, considerar `prisma.$transaction`.

---

# 6. Frontend

## 6.1 Organização

### `pages/`

Responsável por telas e coordenação de funcionalidades.

Pode:

- carregar dados;
- controlar estados da tela;
- lidar com loading;
- lidar com erro;
- chamar services;
- coordenar componentes.

---

### `components/`

Responsável por componentes reutilizáveis.

Antes de criar um novo componente:

1. procurar componente equivalente;
2. verificar padrões visuais existentes;
3. reutilizar componentes quando fizer sentido.

Evitar criar componentes genéricos sem necessidade real.

---

### `services/`

Responsável pela comunicação com a API.

As chamadas HTTP devem permanecer centralizadas nessa camada.

Existe uma instância compartilhada do Axios.

Não utilizar `axios` diretamente em páginas quando já existir ou puder ser criado um service específico.

Fluxo preferencial:

```text
Page
  ↓
frontend service
  ↓
Axios
  ↓
API
```

---

### `utils/`

Responsável por funções reutilizáveis, como:

- formatação;
- transformação de dados;
- funções auxiliares sem estado.

Não colocar regras críticas do domínio exclusivamente no frontend.

---

# 7. Princípio de domínio mais importante: agenda do aluno

A agenda é parte central do Elo Escolar.

Uma agenda consolidada pode envolver:

```text
Turma regular
+
Oficinas
+
Atendimentos clínicos
```

Sempre que uma alteração puder afetar agenda ou matrícula, verificar possíveis impactos sobre:

- turno;
- dia da semana;
- frequência do aluno;
- horário inicial;
- horário final;
- capacidade da turma/oficina;
- outras oficinas;
- atendimentos clínicos;
- status do aluno;
- status da atividade.

As validações críticas devem existir no backend.

O frontend pode antecipar validações para experiência do usuário, mas **não deve ser a única camada responsável por garantir as regras do domínio**.

---

# 8. Gestão de alunos

O módulo de alunos deve permitir, conforme o estágio da implementação:

- cadastro;
- listagem;
- visualização detalhada;
- edição;
- ativação;
- inativação;
- exclusão;
- visualização da agenda;
- matrícula em turma regular;
- inscrição em oficinas.

Dados documentados para o aluno incluem:

- nome completo;
- telefone;
- data de nascimento;
- nome do responsável;
- telefone do responsável;
- turno/período;
- frequência;
- participação no almoço;
- turma regular.

Nem todos precisam necessariamente estar implementados no mesmo estágio atual do sistema.

---

## 8.1 Status de aluno

A documentação prevê o conceito de aluno em rascunho.

Um aluno em rascunho:

- pode possuir uma agenda sendo estruturada;
- não deve ocupar vagas efetivas;
- precisa passar novamente pelas validações antes de tornar-se ativo.

Ao ativar um aluno que estava em rascunho, as regras de conflito e disponibilidade devem ser verificadas novamente.

Não presumir disponibilidade de vaga baseada apenas no momento em que o rascunho foi criado.

---

## 8.2 Alterações que afetam agenda

Alterações de informações como:

- turno;
- frequência;
- turma;
- oficinas;

podem afetar a agenda existente.

Antes de implementar essas alterações de forma simples, verificar os requisitos de conflito.

Nunca remover vínculos ou agenda silenciosamente quando a operação exigir confirmação do usuário.

---

# 9. Turmas e oficinas

O modelo de domínio utiliza `turma` para representar:

- turma regular;
- oficina.

A distinção ocorre através do tipo da turma.

Não criar uma entidade completamente separada para oficina sem analisar primeiro o modelo Prisma e o impacto sobre o domínio existente.

---

## 9.1 Turmas regulares

Podem possuir informações como:

- nome;
- turno;
- sala/ambiente;
- vagas;
- descrição;
- profissionais;
- cronograma.

A documentação define cronogramas fixos relacionados ao período da turma regular.

Antes de codificar horários diretamente, verificar se o projeto já possui representação persistida para horários.

Evitar duplicar regras entre constantes do código e registros do banco sem necessidade.

---

## 9.2 Oficinas

Oficinas podem envolver:

- nome;
- turno;
- frequência;
- dia da semana;
- horário;
- sala;
- vagas;
- descrição;
- profissionais responsáveis.

Uma oficina deve respeitar:

- turno do aluno;
- frequência do aluno;
- vagas;
- conflito com outros compromissos.

---

# 10. Matrículas em oficinas

A inscrição em oficinas é uma das funcionalidades centrais já implementadas.

O fluxo esperado é aproximadamente:

```text
Frontend
   ↓
seleção de oficina(s)
   ↓
matriculasService
   ↓
API
   ↓
controller
   ↓
matriculaService
   ↓
validações
   ↓
Prisma / transação
```

Antes de gravar matrícula em oficina, verificar:

1. aluno válido;
2. situação/status do aluno;
3. oficina válida e ativa;
4. compatibilidade de turno;
5. dias de frequência;
6. capacidade disponível;
7. matrícula duplicada;
8. conflitos entre oficinas selecionadas;
9. conflitos com compromissos existentes.

Quando houver mais de uma matrícula sendo criada em uma única operação, preservar atomicidade utilizando transação quando necessário.

---

## 10.1 Conflitos

A documentação estabelece que o sistema deve impedir a conclusão da inscrição quando existirem conflitos não resolvidos.

Conflitos podem envolver:

```text
OFICINA x OFICINA
OFICINA x ATENDIMENTO CLÍNICO
OFICINA x TURNO DO ALUNO
OFICINA x FREQUÊNCIA DO ALUNO
OFICINA x CAPACIDADE
```

A API atualmente pode responder com:

```text
HTTP 409 Conflict
```

quando encontrar conflito de matrícula.

Preservar esse comportamento quando estiver trabalhando nesse fluxo, salvo se houver tarefa explícita para padronizar os contratos de erro.

Quando retornar conflitos, fornecer dados suficientes para que o frontend consiga informar ao usuário:

- qual atividade gerou o conflito;
- motivo;
- horário ou regra envolvida.

---

# 11. Atendimentos clínicos

Atendimentos clínicos podem ser:

- eventuais;
- semanais;
- mensais.

O backend atualmente possui lógica relacionada à geração de sessões.

O domínio diferencia:

```text
atendimento_clinico
```

que representa a configuração do atendimento,

de:

```text
atendimento_sessao
```

que representa cada ocorrência concreta.

Não substituir essa estrutura por uma única entidade sem avaliar impactos sobre recorrência e histórico.

---

## 11.1 Recorrência

Atendimentos recorrentes devem permitir uma regra de repetição com:

- frequência;
- unidade;
- data inicial;
- data final;
- dias da semana quando aplicável.

Para recorrência semanal:

```text
a cada X semanas
+
um ou mais dias da semana
```

Para recorrência mensal:

```text
a cada X meses
```

A documentação estabelece regras específicas para geração das ocorrências.

Ao modificar algoritmos de recorrência:

1. analisar os testes existentes;
2. preservar sessões históricas;
3. testar datas de limite;
4. testar virada de mês;
5. testar múltiplos dias;
6. evitar gerar sessões duplicadas.

---

# 12. Agenda consolidada

A agenda ideal do aluno deve consolidar:

```text
turma regular
+
oficinas
+
sessões clínicas
```

O estado atual da implementação ainda pode não apresentar todos esses elementos em uma única resposta.

Antes de alterar a agenda:

1. verificar os endpoints existentes;
2. identificar o formato atual de resposta;
3. verificar como o frontend consome esse contrato;
4. evitar quebra de compatibilidade.

Ordenar eventos cronologicamente quando a funcionalidade exigir uma visão temporal.

---

# 13. Profissionais

A documentação prevê gestão dos profissionais da instituição.

Os profissionais podem possuir funções como:

- Professor;
- Oficineiro;
- Terapeuta;
- Auxiliar.

Dados previstos incluem:

- nome;
- função;
- email;
- telefone.

Regras importantes:

- email, quando informado, deve ser válido;
- evitar duplicidade quando a regra existir no schema;
- telefone deve seguir o padrão definido pela aplicação;
- profissionais envolvidos em atividades ativas podem possuir restrições para exclusão ou inativação.

Antes de excluir registros relacionados, verificar integridade referencial e vínculos ativos.

---

# 14. Usuários, autenticação e autorização

Existe modelo de usuário no banco, porém a autenticação e autorização podem ainda não estar implementadas integralmente.

A documentação prevê dois conceitos:

```text
AUTENTICAÇÃO
Quem é o usuário?
```

e:

```text
AUTORIZAÇÃO
O que esse usuário pode fazer?
```

Não tratar esses conceitos como equivalentes.

---

## 14.1 Perfis documentados

### Administrador

Deve possuir acesso completo às funcionalidades administrativas.

### Professor

Pode acessar funcionalidades necessárias à rotina escolar, mas deve possuir restrições sobre alterações gerenciais conforme as regras do produto.

Quando implementar autorização:

- não confiar apenas em bloqueios visuais do frontend;
- validar autorização no backend;
- proteger endpoints;
- não enviar informações sensíveis desnecessárias.

---

## 14.2 Senhas

Senhas nunca devem ser:

- armazenadas em texto puro;
- retornadas por endpoints;
- registradas em logs;
- expostas em mensagens de erro.

Utilizar algoritmo adequado de hashing de senha quando a autenticação for implementada.

---

# 15. Segurança e LGPD

O sistema manipula dados pessoais de alunos e responsáveis.

Tratar os dados de forma compatível com os requisitos de privacidade do projeto.

Evitar:

- logs contendo informações sensíveis;
- exposição desnecessária de entidades completas;
- retorno de campos internos sem necessidade;
- inclusão de credenciais no código;
- secrets versionados no Git.

Variáveis sensíveis devem permanecer em arquivos de ambiente ou configuração segura.

Nunca adicionar ao repositório valores reais de:

```text
DATABASE_URL
JWT_SECRET
senhas
tokens
credenciais
```

---

# 16. Contratos da API

O projeto ainda possui diferenças entre formatos de resposta de endpoints.

Portanto, antes de modificar uma resposta:

1. localizar os consumidores no frontend;
2. verificar se o formato já está sendo utilizado;
3. evitar alterações incompatíveis desnecessárias.

Não expor automaticamente objetos Prisma inteiros apenas porque estão disponíveis.

Preferir contratos explícitos quando estiver criando novos endpoints.

---

## 16.1 Status HTTP

Usar códigos HTTP coerentes.

Exemplos:

```text
200 OK
```

Consulta ou alteração realizada.

```text
201 Created
```

Recurso criado.

```text
400 Bad Request
```

Entrada inválida.

```text
404 Not Found
```

Recurso inexistente.

```text
409 Conflict
```

Operação válida estruturalmente, porém impedida por regra ou conflito de estado.

```text
500 Internal Server Error
```

Erro interno não esperado.

Antes de introduzir um padrão diferente, verificar os endpoints existentes relacionados.

---

# 17. Tratamento de erros

O código atual possui tratamento de erros repetido e nem todos os endpoints retornam o mesmo formato.

Essa é uma dívida técnica conhecida.

Ao implementar uma funcionalidade:

- não aumentar a inconsistência;
- reutilizar padrões existentes quando possível;
- fornecer mensagens úteis;
- evitar detalhes internos do servidor;
- não retornar stack trace ao cliente.

Não realizar uma refatoração global de tratamento de erros quando a tarefa for localizada, salvo solicitação explícita.

---

# 18. Banco de dados

A modelagem utiliza PostgreSQL através do Prisma.

Entidades centrais incluem:

```text
pessoa
aluno
funcionario
usuario
turma
matricula_turma
atendimento_clinico
atendimento_sessao
```

A entidade `pessoa` concentra informações pessoais compartilhadas por diferentes perfis.

Não duplicar dados pessoais em novas tabelas sem analisar se devem pertencer a `pessoa`.

---

## 18.1 Pessoa

`pessoa` funciona como entidade base para informações pessoais.

Pode possuir relacionamentos com:

- aluno;
- funcionário;
- usuário.

Preservar essa estratégia ao adicionar funcionalidades relacionadas a pessoas.

---

## 18.2 Matrícula

`matricula_turma` representa a associação entre aluno e turma.

Ao trabalhar com matrícula, considerar:

- status;
- período;
- duplicidade;
- capacidade;
- histórico;
- efeitos sobre agenda.

---

## 18.3 Alterações no schema

Antes de modificar:

```text
backend/prisma/schema.prisma
```

verificar:

1. modelos existentes;
2. enums existentes;
3. relacionamentos;
4. índices;
5. constraints;
6. migrations existentes;
7. impacto sobre dados existentes;
8. services que utilizam o campo;
9. respostas da API;
10. frontend.

Não remover ou renomear colunas existentes sem avaliar migração e impacto.

Após alteração no Prisma, quando possível executar:

```bash
npx prisma format
npx prisma validate
```

Quando uma migration fizer parte da tarefa, utilizar nomenclatura descritiva.

---

# 19. Transações

Utilizar transações para operações que precisam ocorrer integralmente.

Exemplos existentes ou esperados:

### Cadastro de aluno

```text
criar pessoa
+
criar aluno
+
criar matrícula regular quando aplicável
```

### Matrícula em oficinas

```text
validar
+
criar uma ou múltiplas matrículas
```

### Atendimento clínico

```text
criar atendimento
+
criar sessões correspondentes
```

Evitar deixar o banco em estado parcialmente atualizado.

---

# 20. Requisitos funcionais de referência

Os requisitos documentados estão organizados aproximadamente assim:

```text
RF-01 — Autenticação e Controle de Acesso

RF-02 — Cadastro de Profissionais

RF-03 — Cadastro de Turmas e Oficinas

RF-04 — Cadastro e Gestão de Alunos

RF-05 — Atendimentos Clínicos

RF-06 — Gestão da Agenda do Aluno

RF-07 — Emissão de Diários de Classe
```

Quando uma tarefa citar um requisito pelo identificador, utilizar a documentação como referência de comportamento.

Não interpretar que todos os RFs estão implementados.

---

# 21. Requisitos não funcionais importantes

## Segurança

Os dados pessoais devem ser protegidos.

A comunicação em produção deve utilizar HTTPS.

---

## Performance

A validação de conflitos de agenda deve permanecer eficiente.

Evitar algoritmos desnecessariamente quadráticos quando houver possibilidade simples de otimização.

Não realizar micro-otimizações sem evidência de necessidade.

---

## Responsividade

As interfaces devem funcionar adequadamente em:

- desktop;
- notebook;
- tablet.

Preservar responsividade ao modificar componentes.

---

## Compatibilidade

Evitar APIs ou recursos frontend sem suporte adequado nos navegadores modernos definidos pelo projeto.

---

## Arquitetura desacoplada

Frontend e backend devem permanecer desacoplados.

A comunicação deve ocorrer por API.

Não importar arquivos do backend diretamente no frontend ou vice-versa.

---

# 22. Infraestrutura planejada

A documentação prevê:

```text
Frontend → Vercel
Backend  → Render
Banco    → Neon PostgreSQL
```

A configuração atual pode estar focada no ambiente local.

Não adicionar dependências específicas desses provedores sem necessidade.

Todo código deve continuar funcional em desenvolvimento local.

---

# 23. Estado atual conhecido dos módulos

Ao analisar o projeto, considerar o seguinte cenário como referência inicial, confirmando sempre no código antes de alterar qualquer coisa.

## Implementação existente ou substancialmente existente

- cadastro de alunos;
- listagem de alunos;
- detalhes do aluno;
- calendário do aluno;
- matrícula regular;
- inscrição em oficinas;
- validação de conflitos de oficinas;
- backend de atendimentos clínicos;
- geração de sessões clínicas.

## Parcial ou pendente

### Home

A página inicial ainda possui pouca ou nenhuma implementação funcional.

### Atendimentos clínicos

Backend existente.

Frontend ainda incompleto.

### Agenda consolidada

Horários de turma/oficina já podem estar presentes.

Sessões clínicas ainda precisam ser completamente integradas à visão unificada.

### Usuários

Existe modelagem.

Fluxo completo de autenticação/autorização ainda não está concluído.

### Turmas

Existem estruturas de domínio, porém telas administrativas ainda podem estar incompletas.

### Profissionais

Existem estruturas de domínio, porém telas administrativas ainda podem estar incompletas.

### Diários de classe

Funcionalidade prevista pela documentação, podendo ainda estar pendente.

Antes de iniciar qualquer uma dessas funcionalidades, confirmar o estado atual no código.

---

# 24. Testes

Existem testes relacionados principalmente à geração de datas de atendimentos clínicos.

A cobertura ainda é limitada.

Ao alterar código relacionado a recorrência ou geração de sessões:

**executar e preservar os testes existentes.**

Ao corrigir um bug relevante, preferencialmente adicionar teste que reproduza o problema quando a estrutura atual permitir.

Prioridades de teste:

1. regras de conflito;
2. recorrência;
3. capacidade de oficinas;
4. transações;
5. mudanças de status;
6. contratos críticos da API.

Não adicionar infraestrutura complexa de testes sem necessidade para uma alteração pequena.

---

# 25. Regras gerais para alterações

Antes de criar ou alterar código:

1. localizar os arquivos relacionados;
2. entender o fluxo atual;
3. procurar implementação semelhante;
4. verificar os modelos Prisma envolvidos;
5. identificar regras de negócio relacionadas;
6. verificar quem consome o código;
7. então realizar a alteração.

---

## 25.1 Preservar o escopo

Não fazer refatorações não solicitadas apenas porque seria possível melhorar determinada área.

Exemplo:

Se a tarefa é:

```text
adicionar telefone ao formulário de profissional
```

não aproveitar automaticamente para:

```text
reescrever autenticação;
trocar arquitetura;
criar Repository Pattern;
migrar JavaScript para TypeScript;
trocar Axios;
adicionar Redux;
reescrever todos os controllers.
```

Mudanças relacionadas podem ser sugeridas, mas não devem ser implementadas silenciosamente.

---

# 26. Regra de menor alteração necessária

Preferir a menor mudança que:

- atenda o requisito;
- preserve a arquitetura;
- preserve compatibilidade;
- mantenha legibilidade;
- não gere dívida técnica desnecessária.

Evitar alterações massivas quando uma solução localizada for suficiente.

---

# 27. Não inventar estruturas

Antes de criar:

```text
novo service
novo DTO
novo componente
novo util
nova tabela
novo campo
nova rota
novo hook
nova dependência
```

procurar estruturas equivalentes existentes.

Não assumir nomes de entidades, campos ou endpoints.

Consultar o código.

---

# 28. Dependências

Antes de adicionar uma nova biblioteca:

1. verificar se a funcionalidade pode ser implementada com dependências existentes;
2. verificar em qual `package.json` ela pertence;
3. avaliar impacto;
4. evitar dependências para funcionalidades triviais.

Não instalar dependências no diretório raiz presumindo que exista um único projeto Node.

Frontend e backend possuem dependências independentes.

---

# 29. Formatação e estilo de código

Seguir o estilo existente no arquivo e no módulo.

Não realizar reformatação em massa de arquivos que não tenham relação com a tarefa.

Preservar:

- convenções de nomes;
- padrão de import/export;
- CommonJS no backend;
- ES Modules no frontend;
- padrão atual de organização.

---

# 30. Comentários

Não adicionar comentários explicando código trivial.

Comentários são apropriados quando explicam:

- regra de negócio não óbvia;
- decisão arquitetural;
- workaround necessário;
- algoritmo de recorrência;
- regra complexa de calendário.

Preferir nomes claros a comentários excessivos.

---

# 31. Datas e horários

O sistema possui regras importantes relacionadas a calendário.

Ao trabalhar com datas:

- evitar comparações de datas como strings quando não forem seguras;
- considerar timezone;
- considerar início e fim do intervalo;
- verificar sobreposição real dos horários;
- evitar duplicação de sessões;
- preservar datas já realizadas quando a regra exigir histórico.

Para verificar conflito entre intervalos, considerar conceitualmente:

```text
inicioA < fimB
AND
fimA > inicioB
```

adaptando conforme as regras existentes no projeto.

Sempre verificar a implementação atual antes de substituir algoritmos de conflito.

---

# 32. Capacidade de oficinas

Quando uma oficina possuir limite de vagas:

```text
ocupação atual < capacidade máxima
```

deve ser validado antes da confirmação.

Não contar matrículas que, conforme o domínio existente, não ocupem vagas.

Ao trabalhar com alunos em rascunho, considerar a regra documentada de que rascunhos não devem reservar vagas definitivamente.

---

# 33. Exclusões e inativações

Excluir e inativar possuem significados diferentes.

Antes de implementar exclusão:

- verificar vínculos;
- verificar histórico;
- verificar requisitos;
- verificar constraints do banco.

Não utilizar exclusão em cascata indiscriminadamente apenas para facilitar uma operação.

Quando houver histórico relevante, verificar se o domínio exige preservação.

---

# 34. Experiência do usuário

Em formulários:

- preservar dados preenchidos quando ocorrer erro de validação;
- mostrar mensagem compreensível;
- evitar mensagens técnicas;
- informar conflitos de forma específica.

Exemplo ruim:

```text
Erro ao processar.
```

Exemplo melhor:

```text
Não foi possível realizar a inscrição porque a oficina selecionada
conflita com outro horário da agenda do aluno.
```

Quando possível, exibir qual atividade causou o conflito.

---

# 35. Fluxo recomendado para implementar uma tarefa

Ao receber uma tarefa de desenvolvimento, seguir esta ordem.

## Etapa 1 — Entendimento

Identificar:

```text
Qual requisito está sendo atendido?
Qual módulo está envolvido?
Qual comportamento atual existe?
Qual comportamento esperado?
```

---

## Etapa 2 — Investigação

Localizar:

```text
rota
controller
DTO
service
modelo Prisma
service frontend
page
componentes relacionados
testes
```

Nem todas as tarefas utilizarão todas essas camadas.

---

## Etapa 3 — Plano

Antes de alterações grandes, apresentar um plano curto contendo:

- arquivos que serão alterados;
- comportamento atual;
- mudança proposta;
- riscos ou impactos.

Para alterações pequenas e evidentes, não é necessário produzir documentação extensa antes de trabalhar.

---

## Etapa 4 — Implementação

Realizar apenas as mudanças necessárias.

---

## Etapa 5 — Validação

Verificar:

```text
lint
testes
build
validação Prisma
fluxo afetado
```

conforme scripts realmente disponíveis nos respectivos `package.json`.

Nunca inventar comandos sem verificar os scripts existentes.

---

## Etapa 6 — Resultado

Ao finalizar, informar de forma objetiva:

- o que foi alterado;
- arquivos principais;
- regras implementadas;
- testes executados;
- eventuais limitações restantes.

---

# 36. Quando a tarefa for apenas de análise

Quando solicitado algo como:

```text
analise
revise
investigue
descubra
identifique
explique
```

não modificar arquivos automaticamente.

Primeiro retornar a análise encontrada.

Especialmente para bugs:

1. reproduzir mentalmente ou via testes quando possível;
2. rastrear o fluxo;
3. identificar a causa;
4. distinguir causa de sintoma;
5. só alterar código quando solicitado ou quando a tarefa explicitamente pedir correção.

---

# 37. Quando a tarefa envolver banco

Antes de alterar banco:

```text
schema.prisma
   ↓
migration
   ↓
services
   ↓
controllers
   ↓
frontend
```

Verificar todo o impacto vertical.

Evitar modificar schema sem verificar código consumidor.

---

# 38. Quando a tarefa envolver frontend e backend

Tratar o contrato da API como fronteira.

Verificar:

```text
Frontend espera:
{
  ...
}

Backend retorna:
{
  ...
}
```

Não corrigir apenas um lado quando isso deixar o outro incompatível.

---

# 39. Dívidas técnicas conhecidas

Existem alguns pontos conhecidos de evolução.

## Tratamento de erros

Ainda não é completamente padronizado.

## Contratos de resposta

Alguns endpoints retornam estruturas diferentes ou relações Prisma diretamente.

## CORS

A configuração atual está direcionada ao desenvolvimento local.

## Autenticação

Ainda precisa ser concluída.

## Testes

Cobertura ainda limitada.

## CI/CD

Pode não existir configuração automatizada no repositório.

## Documentação técnica

Ainda pode ser ampliada.

Esses itens são **contexto**, não autorização automática para refatorá-los.

---

# 40. Prioridades do domínio

Quando houver dúvida entre conveniência de implementação e integridade do domínio, priorizar nesta ordem:

```text
1. Integridade dos dados
2. Regras de agenda e conflitos
3. Histórico necessário
4. Segurança e privacidade
5. Consistência dos contratos
6. Experiência do usuário
7. Simplicidade da implementação
```

---

# 41. Regra final para o agente

Antes de qualquer alteração relevante, responda internamente a estas perguntas:

```text
1. Eu entendi o requisito?
2. Eu li o código relacionado?
3. Existe implementação semelhante?
4. Estou preservando a arquitetura atual?
5. Existe alguma regra de agenda envolvida?
6. Existe risco de quebrar dados existentes?
7. Preciso de transação?
8. O frontend depende desse contrato?
9. Há teste relacionado?
10. Estou alterando somente o necessário?
```

Se alguma resposta estiver incerta, investigar o repositório antes de implementar.

---

# 42. Fonte da verdade

Utilizar a seguinte prioridade de fontes:

```text
Para saber COMO o sistema funciona hoje:
Código atual

Para saber COMO uma funcionalidade deveria funcionar:
Documentação de requisitos

Para saber COMO manter consistência:
Código atual + documentação + testes
```

Nunca assumir que uma funcionalidade documentada já existe.

Nunca assumir que uma implementação existente representa integralmente o requisito.

Sempre comparar os dois contextos quando a tarefa envolver evolução funcional.