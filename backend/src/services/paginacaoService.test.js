const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { paginarIds, formatarPagina } = require('./paginacaoService');
const { lerPaginacao } = require('../dtos/paginacaoDTO');

for (const recurso of ['oficinas_aluno', 'alunos_turma']) {
  test(`${recurso}: seleção e contagem usam o mesmo dia civil para excluir matrículas vencidas`, async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-03T01:30:00Z') });
    const consultas = simular(t, [[]], 0);
    const pagina = await paginarIds(recurso, lerPaginacao({ paginado: 'true' }), { alunoId: 1, turmaId: 10 });
    assert.equal(pagina.total, 0);
    assert.equal(consultas.length, 2);
    for (const consulta of consultas) {
      assert.ok(consulta.texto.includes("m.status = 'ATIVO' AND (m.data_fim IS NULL OR m.data_fim >="));
      assert.ok(consulta.valores.includes('2026-11-02'));
    }
  });
}

test('PostgreSQL: paginação de matrículas conta e lista somente vínculos vigentes',
  { skip: process.env.TESTAR_MATRICULAS_POSTGRES !== '1' }, async () => {
    require('dotenv').config({ quiet: true });
    const original = prisma.$queryRaw;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('CREATE TEMP TABLE pessoa (id integer, nome text) ON COMMIT DROP');
        await tx.$executeRawUnsafe('CREATE TEMP TABLE aluno (id integer, pessoa_id integer, status text, deleted_at timestamp) ON COMMIT DROP');
        await tx.$executeRawUnsafe('CREATE TEMP TABLE turma (id integer, nome text, tipo text, deleted_at timestamp) ON COMMIT DROP');
        await tx.$executeRawUnsafe('CREATE TEMP TABLE matricula_turma (id integer, aluno_id integer, turma_id integer, status text, data_inicio date, data_fim date) ON COMMIT DROP');
        await tx.$executeRawUnsafe("INSERT INTO pessoa VALUES (1, 'Aluno')");
        await tx.$executeRawUnsafe("INSERT INTO aluno VALUES (1, 1, 'RASCUNHO', NULL)");
        await tx.$executeRawUnsafe("INSERT INTO turma SELECT i, 'Oficina ' || lpad(i::text, 2, '0'), 'OFICINA', NULL FROM generate_series(1, 30) i");
        await tx.$executeRawUnsafe(`INSERT INTO matricula_turma
          SELECT i, 1, i, 'ATIVO', '2026-10-01'::date, CASE WHEN i % 5 = 0 THEN '2026-11-01'::date ELSE NULL END
          FROM generate_series(1, 25) i`);
        await tx.$executeRawUnsafe("INSERT INTO matricula_turma VALUES (26,1,26,'ATIVO','2026-12-01',NULL),(27,1,27,'ATIVO','2026-10-01','2026-11-02'),(28,1,28,'PROVISORIO',NULL,NULL),(29,1,29,'PROVISORIO',NULL,'2026-11-02'),(30,1,30,'INATIVO','2026-10-01','2026-11-02')");
        const consultar = tx.$queryRaw.bind(tx);
        prisma.$queryRaw = (...args) => consultar(...args);
        const params = lerPaginacao({ paginado: 'true' });
        const contexto = { alunoId: 1, hoje: new Date('2026-11-02T00:00:00Z') };
        const primeira = await paginarIds('oficinas_aluno', params, contexto);
        assert.equal(primeira.total, 23);
        assert.equal(primeira.total_ativas, 22);
        assert.equal(primeira.ids.length, 20);
        assert.equal(primeira.tem_mais, true);
        assert.ok(primeira.ids.every((id) => id % 5 !== 0));
        const segunda = await paginarIds('oficinas_aluno', { ...params, cursor: primeira.proximo_cursor }, contexto);
        assert.deepEqual(segunda.ids, [26, 27, 28]);
        assert.equal(segunda.tem_mais, false);
        const alunos = await paginarIds('alunos_turma', params, { turmaId: 5, hoje: contexto.hoje });
        assert.equal(alunos.total, 0);
        const reserva = await paginarIds('alunos_turma', params, { turmaId: 26, hoje: contexto.hoje });
        assert.equal(reserva.total, 1);
        const diaSeguinte = await paginarIds('oficinas_aluno', params, { ...contexto, hoje: new Date('2026-11-03T00:00:00Z') });
        assert.equal(diaSeguinte.total, 22);
        assert.equal(diaSeguinte.total_ativas, 21);
      }, { timeout: 10000 });
    } finally { prisma.$queryRaw = original; }
  });

function simular(t, paginas, total = 41, contagensTurmas = [{ status: 'ATIVO', total: 30n }, { status: 'INATIVO', total: 11n }]) {
  const original = prisma.$queryRaw, consultas = [];
  t.after(() => { prisma.$queryRaw = original; });
  prisma.$queryRaw = async (sql) => {
    const texto = sql.text ?? sql.join('?');
    consultas.push({ texto, valores: sql.values });
    if (['GROUP BY t.status', 'GROUP BY p.status_geral', 'GROUP BY a.status'].some(grupo => texto.includes(grupo))) return contagensTurmas;
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

test('Home filtra status e ano antes de contar e paginar turmas, sem reutilizar cursor de outro ano', async (t) => {
  const registros = Array.from({ length: 21 }, (_, i) => ({ id: i + 1, chave: `Turma ${String(i).padStart(2, '0')}` }));
  const consultas = simular(t, [registros], 25, [{ status: 'ATIVO', total: 25n }, { status: 'INATIVO', total: 2n }]);
  const params = lerPaginacao({ paginado: 'true', tipo: 'REGULAR', status: 'ATIVO', ano: '2026' });
  const pagina = await paginarIds('turmas', params);
  assert.equal(pagina.ids.length, 20);
  assert.equal(pagina.total, 25);
  for (const consulta of consultas) {
    assert.ok(consulta.texto.includes('al.ano ='));
    assert.ok(consulta.valores.includes(2026));
    if (!consulta.texto.includes('GROUP BY t.status')) {
      assert.ok(consulta.texto.includes('t.status::text ='));
      assert.ok(consulta.valores.includes('ATIVO'));
    }
  }
  assert.deepEqual(pagina.contagens_status, { TODOS: 27, ATIVO: 25, INATIVO: 2 });
  await assert.rejects(() => paginarIds('turmas', { ...params, ano: 2027, cursor: pagina.proximo_cursor }), { statusCode: 400 });
});

test('consulta de turmas sem filtros novos preserva o contrato usado por modais e listagens', async (t) => {
  const consultas = simular(t, [[]], 0);
  await paginarIds('turmas', lerPaginacao({ paginado: 'true', tipo: 'OFICINA' }));
  assert.ok(consultas.every((c) => !c.texto.includes('t.status::text =') && !c.texto.includes('ano_letivo al')));
});

for (const tipo of ['REGULAR', 'OFICINA']) {
  test(`totalizadores de ${tipo} contam todos os status da aba, independentemente da busca e dos vinte carregados`, async t => {
    const registros = Array.from({ length: 21 }, (_, i) => ({ id: i + 1, chave: `Turma ${i}` }));
    const consultas = simular(t, [registros], 25);
    const pagina = await paginarIds('turmas', lerPaginacao({ paginado: 'true', tipo, status: 'ATIVO', busca: 'Girassol' }));
    assert.equal(pagina.ids.length, 20);
    assert.equal(pagina.total, 25);
    assert.deepEqual(pagina.contagens_status, { TODOS: 41, ATIVO: 30, INATIVO: 11 });
    const totais = consultas.find(c => c.texto.includes('GROUP BY t.status'));
    assert.ok(totais.texto.includes('t.deleted_at IS NULL'));
    assert.ok(totais.texto.includes('t.tipo::text ='));
    assert.deepEqual(totais.valores, [tipo]);
    assert.ok(!totais.texto.includes('LIMIT') && !totais.texto.includes('t.status::text =') && !totais.texto.includes('strpos'));
    const resposta = formatarPagina(pagina.ids.map(id => ({ id })), pagina);
    assert.deepEqual(resposta.contagens_status, pagina.contagens_status);
  });
}

test('totalizadores de uma aba sem turmas retornam todos os valores em zero', async t => {
  simular(t, [[]], 0, []);
  const pagina = await paginarIds('turmas', lerPaginacao({ paginado: 'true', tipo: 'OFICINA' }));
  assert.deepEqual(pagina.contagens_status, { TODOS: 0, ATIVO: 0, INATIVO: 0 });
});

for (const [recurso, coluna, tabela] of [['profissionais', 'p.status_geral', 'funcionario'], ['usuarios', 'a.status', 'usuario']]) {
  for (const status of ['ATIVO', 'INATIVO', 'TODOS']) {
    test(`totalizadores e filtro de ${recurso} com status ${status} respeitam a origem do status e ignoram paginação e busca nas contagens`, async t => {
      const registros = Array.from({ length: 21 }, (_, i) => ({ id: i + 1, chave: `Nome ${i}` }));
      const consultas = simular(t, [registros], 25);
      const pagina = await paginarIds(recurso, lerPaginacao({ paginado: 'true', status, busca: 'Silva' }));
      assert.equal(pagina.ids.length, 20);
      assert.equal(pagina.total, 25);
      assert.deepEqual(pagina.contagens_status, { TODOS: 41, ATIVO: 30, INATIVO: 11 });
      const contagem = consultas.find(c => c.texto.includes(`GROUP BY ${coluna}`));
      assert.ok(contagem.texto.includes(`${tabela} a JOIN pessoa p`));
      assert.ok(contagem.texto.includes('a.deleted_at IS NULL'));
      assert.deepEqual(contagem.valores, []);
      assert.ok(!contagem.texto.includes('LIMIT') && !contagem.texto.includes('strpos'));
      for (const consulta of consultas.filter(c => c !== contagem)) {
        assert.equal(consulta.texto.includes(`${coluna}::text =`), status !== 'TODOS');
        assert.equal(consulta.valores.includes(status), status !== 'TODOS');
        assert.ok(consulta.valores.includes('silva'));
      }
      assert.deepEqual(formatarPagina(pagina.ids.map(id => ({ id })), pagina).contagens_status, pagina.contagens_status);
    });
  }

  test(`totalizadores de ${recurso} sem registros retornam zero`, async t => {
    simular(t, [[]], 0, []);
    const pagina = await paginarIds(recurso, lerPaginacao({ paginado: 'true' }));
    assert.deepEqual(pagina.contagens_status, { TODOS: 0, ATIVO: 0, INATIVO: 0 });
  });
}

test('calendários carregam vinte por vez, em ordem decrescente de ano e com cursor', async (t) => {
  const registros = Array.from({ length: 21 }, (_, i) => ({ id: 2100 - i, chave: String(2100 - i) }));
  const consultas = simular(t, [registros, registros.slice(20)], 21);
  const params = lerPaginacao({ paginado: 'true' });
  const primeira = await paginarIds('anos_letivos', params);
  const segunda = await paginarIds('anos_letivos', { ...params, cursor: primeira.proximo_cursor });
  assert.equal(primeira.ids.length, 20);
  assert.deepEqual(segunda.ids, [2080]);
  assert.equal(segunda.tem_mais, false);
  assert.ok(consultas.some((c) => c.texto.includes("ORDER BY lpad(a.ano::text, 4, '0') DESC, a.id DESC LIMIT 21")));
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
