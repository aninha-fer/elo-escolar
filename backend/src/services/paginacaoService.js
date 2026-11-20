const { Prisma } = require('@prisma/client');
const { createHash } = require('node:crypto');
const prisma = require('../prismaClient');
const { cursorDTO } = require('../dtos/paginacaoDTO');

function normalizarBusca(valor = '') {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

function contem(coluna, busca) {
  // Equivale à normalização NFD do frontend, sem depender de extensões do banco.
  return Prisma.sql`strpos(regexp_replace(normalize(lower(${coluna}), NFD), '[̀-ͯ]', '', 'g'), ${busca}) > 0`;
}

function configurarConsulta(recurso, parametros, alunoId, turmaId) {
  const busca = normalizarBusca(parametros.busca);
  const filtros = [];
  let origem, chave, id, decrescente = false;
  if (['alunos', 'profissionais', 'usuarios'].includes(recurso)) {
    const tabela = { alunos: 'aluno', profissionais: 'funcionario', usuarios: 'usuario' }[recurso];
    origem = Prisma.sql`${Prisma.raw(tabela)} a JOIN pessoa p ON p.id = a.pessoa_id`;
    chave = Prisma.sql`p.nome`; id = Prisma.sql`a.id`;
    filtros.push(Prisma.sql`a.deleted_at IS NULL`);
    if (recurso === 'alunos' && parametros.status !== 'TODOS') filtros.push(Prisma.sql`a.status::text = ${parametros.status}`);
    if (busca) {
      const nome = contem(Prisma.sql`p.nome`, busca);
      if (recurso === 'alunos') filtros.push(Prisma.sql`(${nome} OR EXISTS (SELECT 1 FROM aluno_responsavel ar JOIN pessoa r ON r.id = ar.pessoa_id WHERE ar.aluno_id = a.id AND ${contem(Prisma.sql`r.nome`, busca)}))`);
      else if (recurso === 'usuarios') filtros.push(Prisma.sql`(${nome} OR ${contem(Prisma.sql`coalesce(a.email, '')`, busca)})`);
      else filtros.push(nome);
    }
  } else if (recurso === 'turmas') {
    origem = Prisma.sql`turma t`; chave = Prisma.sql`t.nome`; id = Prisma.sql`t.id`;
    filtros.push(Prisma.sql`t.deleted_at IS NULL`);
    if (parametros.tipo) filtros.push(Prisma.sql`t.tipo::text = ${parametros.tipo}`);
    if (busca) filtros.push(contem(chave, busca));
  } else if (['oficinas_aluno', 'alunos_turma'].includes(recurso)) {
    origem = Prisma.sql`matricula_turma m JOIN turma t ON t.id = m.turma_id JOIN aluno a ON a.id = m.aluno_id JOIN pessoa p ON p.id = a.pessoa_id`;
    id = Prisma.sql`m.id`;
    filtros.push(Prisma.sql`a.deleted_at IS NULL`, Prisma.sql`t.deleted_at IS NULL`);
    if (recurso === 'oficinas_aluno') {
      chave = Prisma.sql`t.nome`;
      filtros.push(Prisma.sql`m.aluno_id = ${alunoId}`, Prisma.sql`t.tipo = 'OFICINA'`,
        Prisma.sql`(m.status = 'ATIVO' OR (m.status = 'PROVISORIO' AND m.data_fim IS NULL AND a.status = 'RASCUNHO'))`);
    } else {
      chave = Prisma.sql`p.nome`;
      filtros.push(Prisma.sql`m.turma_id = ${turmaId}`, Prisma.sql`m.status = 'ATIVO'`);
    }
    if (busca) filtros.push(contem(chave, busca));
  } else if (recurso === 'atendimentos_aluno') {
    origem = Prisma.sql`atendimento_clinico c JOIN aluno a ON a.id = c.aluno_id`;
    id = Prisma.sql`c.id`;
    chave = Prisma.sql`(to_char(c.data_inicio, 'YYYY-MM-DD') || ' ' || to_char(c.hora_inicio, 'HH24:MI:SS.US'))`;
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    filtros.push(Prisma.sql`c.aluno_id = ${alunoId}`, Prisma.sql`a.deleted_at IS NULL`, Prisma.sql`c.data_cancelamento IS NULL`,
      Prisma.sql`(c.status = 'ATIVO' OR (c.status = 'PROVISORIO' AND a.status = 'RASCUNHO'))`,
      Prisma.sql`((c.tipo_recorrencia = 'EVENTUAL' AND c.data_inicio >= ${hoje}::date) OR (c.tipo_recorrencia IN ('SEMANAL', 'MENSAL') AND (c.data_termino IS NULL OR c.data_termino >= ${hoje}::date)))`);
  } else if (recurso === 'ocorrencias_aluno') {
    origem = Prisma.sql`ocorrencia_aluno o`; id = Prisma.sql`o.id`;
    chave = Prisma.sql`to_char(o.ocorrido_em AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US')`;
    decrescente = true;
    filtros.push(Prisma.sql`o.aluno_id = ${alunoId}`);
  } else throw new Error('Listagem não reconhecida.');
  return { origem, chave, id, decrescente, filtro: Prisma.join(filtros, ' AND ') };
}

async function paginarIds(recurso, parametros, contexto = {}) {
  const { origem, chave, id, decrescente, filtro } = configurarConsulta(recurso, parametros, contexto.alunoId, contexto.turmaId);
  const assinatura = createHash('sha256').update(JSON.stringify([recurso, normalizarBusca(parametros.busca), parametros.status, parametros.tipo, contexto])).digest('hex');
  let depois = Prisma.sql`TRUE`;
  if (parametros.cursor) {
    let cursor;
    try { cursor = cursorDTO.parse(JSON.parse(Buffer.from(parametros.cursor, 'base64url').toString('utf8'))); }
    catch { throw Object.assign(new Error('Cursor de paginação inválido.'), { statusCode: 400 }); }
    if (cursor.assinatura !== assinatura) throw Object.assign(new Error('O cursor não corresponde aos filtros da listagem.'), { statusCode: 400 });
    depois = decrescente
      ? Prisma.sql`(${chave} < ${cursor.chave} OR (${chave} = ${cursor.chave} AND ${id} < ${cursor.id}))`
      : Prisma.sql`(${chave} > ${cursor.chave} OR (${chave} = ${cursor.chave} AND ${id} > ${cursor.id}))`;
  }
  const direcao = Prisma.raw(decrescente ? 'DESC' : 'ASC');
  const extraContagem = recurso === 'oficinas_aluno' ? Prisma.sql`, count(*) FILTER (WHERE m.status = 'ATIVO') AS total_ativas` : Prisma.empty;
  const [registros, contagem] = await Promise.all([
    prisma.$queryRaw(Prisma.sql`SELECT ${id} AS id, ${chave} AS chave FROM ${origem} WHERE ${filtro} AND ${depois} ORDER BY ${chave} ${direcao}, ${id} ${direcao} LIMIT 21`),
    prisma.$queryRaw(Prisma.sql`SELECT count(*) AS total ${extraContagem} FROM ${origem} WHERE ${filtro}`),
  ]);
  const itens = registros.slice(0, 20), ultimo = itens.at(-1), temMais = registros.length > 20;
  const pagina = { ids: itens.map((r) => r.id), total: Number(contagem[0].total), tem_mais: temMais,
    proximo_cursor: temMais ? Buffer.from(JSON.stringify({ ...ultimo, assinatura })).toString('base64url') : null };
  if (recurso === 'oficinas_aluno') pagina.total_ativas = Number(contagem[0].total_ativas);
  if (recurso === 'alunos') {
    const contagens = await prisma.$queryRaw`SELECT status, count(*) AS total FROM aluno WHERE deleted_at IS NULL GROUP BY status`;
    pagina.contagens_status = { TODOS: 0, ATIVO: 0, INATIVO: 0, RASCUNHO: 0 };
    for (const grupo of contagens) { pagina.contagens_status[grupo.status] = Number(grupo.total); pagina.contagens_status.TODOS += Number(grupo.total); }
  }
  return pagina;
}

function formatarPagina(itens, pagina) {
  if (!pagina) return itens;
  const porId = new Map(itens.map((item) => [item.id, item]));
  const { ids, ...metadados } = pagina;
  return { itens: ids.map((id) => porId.get(id)).filter(Boolean), ...metadados };
}

module.exports = { paginarIds, formatarPagina };
