const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { paginarIds, formatarPagina } = require('./paginacaoService');
const { lerPaginacao } = require('../dtos/paginacaoDTO');

function simular(t, paginas, total = 41) {
  const original = prisma.$queryRaw, consultas = [];
  t.after(() => { prisma.$queryRaw = original; });
  prisma.$queryRaw = async (sql) => {
    const texto = sql.text ?? sql.join('?');
    consultas.push({ texto, valores: sql.values });
    if (texto.includes('GROUP BY status')) return [{ status: 'ATIVO', total: 30n }, { status: 'RASCUNHO', total: 11n }];
    if (texto.includes('count(*) AS total')) return [{ total: BigInt(total), total_ativas: BigInt(total) }];
    return paginas.shift();
  };
  return consultas;
}

test('paginação é opcional e valida parâmetros antes de consultar', () => {
  assert.equal(lerPaginacao(), null);
  assert.equal(lerPaginacao({ paginado: 'false' }), null);
  assert.equal(lerPaginacao({ paginado: 'true' }).status, 'TODOS');
  for (const query of [{ paginado: 'sim' }, { paginado: 'true', status: 'INVALIDO' }, { paginado: 'true', busca: 'a'.repeat(201) }]) {
    assert.throws(() => lerPaginacao(query));
  }
});

test('entrega 20 registros por página e desempata nomes iguais por ID sem repetir', async (t) => {
  const registros = Array.from({ length: 41 }, (_, i) => ({ id: i + 1, chave: 'Mesmo nome' }));
  const consultas = simular(t, [registros.slice(0, 21), registros.slice(20, 41), registros.slice(40)]);
  const params = lerPaginacao({ paginado: 'true' });
  const primeira = await paginarIds('usuarios', params);
  const segunda = await paginarIds('usuarios', { ...params, cursor: primeira.proximo_cursor });
  const terceira = await paginarIds('usuarios', { ...params, cursor: segunda.proximo_cursor });
  assert.deepEqual([primeira.ids.length, segunda.ids.length, terceira.ids.length], [20, 20, 1]);
  assert.equal(new Set([...primeira.ids, ...segunda.ids, ...terceira.ids]).size, 41);
  assert.equal(primeira.total, 41);
  assert.equal(terceira.tem_mais, false);
  assert.equal(terceira.proximo_cursor, null);
  assert.ok(consultas.some((c) => c.texto.includes('a.id >') && c.valores.includes(20)));
  assert.ok(consultas.some((c) => c.texto.includes('ORDER BY p.nome ASC, a.id ASC LIMIT 21')));
});

test('filtros globais de aluno abrangem responsáveis e normalização de acentos; contagens são independentes da página', async (t) => {
  const consultas = simular(t, [[{ id: 40, chave: 'José' }]], 1);
  const pagina = await paginarIds('alunos', lerPaginacao({ paginado: 'true', busca: '  JOSÉ  ', status: 'ATIVO' }));
  assert.deepEqual(pagina.ids, [40]);
  assert.deepEqual(pagina.contagens_status, { TODOS: 41, ATIVO: 30, INATIVO: 0, RASCUNHO: 11 });
  const limitada = consultas.find((c) => c.texto.includes('LIMIT 21'));
  assert.ok(limitada.texto.includes('aluno_responsavel'));
  assert.ok(limitada.texto.includes('normalize(lower('));
  assert.ok(limitada.valores.includes('jose'));
  assert.ok(limitada.valores.includes('ATIVO'));
});

test('cursor inválido ou reaproveitado com outro filtro é rejeitado', async (t) => {
  const consultas = simular(t, [Array.from({ length: 21 }, (_, i) => ({ id: i + 1, chave: 'Turma' }))]);
  const params = lerPaginacao({ paginado: 'true', tipo: 'REGULAR' });
  const primeira = await paginarIds('turmas', params);
  const antes = consultas.length;
  await assert.rejects(() => paginarIds('turmas', { ...params, cursor: 'invalido' }), { statusCode: 400 });
  await assert.rejects(() => paginarIds('turmas', { ...params, tipo: 'OFICINA', cursor: primeira.proximo_cursor }), { statusCode: 400 });
  assert.equal(consultas.length, antes);
});

test('busca é parametrizada e caracteres SQL permanecem como texto', async (t) => {
  const consultas = simular(t, [[]], 0);
  const busca = "%' OR 1=1 --";
  const pagina = await paginarIds('usuarios', lerPaginacao({ paginado: 'true', busca }));
  assert.deepEqual(pagina.ids, []);
  assert.equal(pagina.total, 0);
  assert.ok(consultas.every((c) => !c.texto.includes(busca)));
  assert.ok(consultas.some((c) => c.valores.includes(busca.toLowerCase())));
});

test('20 resultados exatos encerram a paginação; ocorrências mantêm ordem decrescente', async (t) => {
  const consultas = simular(t, [Array.from({ length: 20 }, (_, i) => ({ id: 20 - i, chave: '2026-11-20 10:00:00.000000' }))], 20);
  const pagina = await paginarIds('ocorrencias_aluno', lerPaginacao({ paginado: 'true' }), { alunoId: 1 });
  assert.equal(pagina.tem_mais, false);
  assert.equal(pagina.proximo_cursor, null);
  assert.ok(consultas.some((c) => c.texto.includes('o.id DESC')));
});

test('formatação preserva contrato legado e a ordem do cursor após consulta das entidades', () => {
  const itens = [{ id: 2 }, { id: 1 }];
  assert.equal(formatarPagina(itens, null), itens);
  assert.deepEqual(formatarPagina(itens, { ids: [1, 2], total: 2, tem_mais: false }).itens, [{ id: 1 }, { id: 2 }]);
});
