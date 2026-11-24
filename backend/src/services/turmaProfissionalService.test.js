const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { profissionaisDaTurma, formatarProfissionaisTurma } = require('./turmaProfissionalService');

const dia = (data) => new Date(`${data}T00:00:00Z`);
const vinculo = (id, inicio, fim) => ({ id, profissional_id: id, data_inicio: inicio ? dia(inicio) : null,
    data_fim: fim ? dia(fim) : null, profissional: { id, cargo: 'Professor', pessoa: { nome: `Nome ${id}`, status_geral: 'ATIVO' } } });

test('vigência inclui os limites, ignora período vazio e não duplica profissional que retorna no mesmo dia', () => {
    const vinculos = [vinculo(1, null, '2026-11-01'), vinculo(2, '2026-11-02', '2026-11-02'),
        vinculo(3, '2026-11-03', '2026-11-02'), vinculo(2, '2026-11-02', null), vinculo(4, '2026-11-04', null)];
    assert.deepEqual(profissionaisDaTurma(vinculos, dia('2026-11-01')).map((p) => p.id), [1]);
    assert.deepEqual(profissionaisDaTurma(vinculos, dia('2026-11-02')).map((p) => p.id), [2]);
    assert.deepEqual(profissionaisDaTurma(vinculos, dia('2026-11-04')).map((p) => p.id), [2, 4]);
});

test('contrato de turma separa equipe atual e histórico sem expor relações internas', () => {
    const anterior = vinculo(1, null, '2026-11-01'), atual = vinculo(2, '2026-11-02', null);
    anterior.profissional.deleted_at = new Date();
    const turma = formatarProfissionaisTurma({ id: 10, profissionais: [anterior, atual] }, true);
    assert.deepEqual(turma.profissionais.map((p) => p.id), [2]);
    assert.equal(turma.historico_profissionais[0].profissional.excluido, true);
    assert.equal(turma.historico_profissionais[0].data_inicio, null);
    assert.equal(turma.historico_profissionais.length, 2);
    assert.equal(turma.profissionais[0].profissional_id, undefined);
    assert.equal(turma.historico_profissionais[0].profissional.deleted_at, undefined);
});

test('migration preserva todos os vínculos e restringe duplicação e exclusão física no PostgreSQL', {
    skip: process.env.TESTAR_VINCULOS_POSTGRES !== '1',
}, async () => {
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    const schema = `teste_vinculos_${randomUUID().replaceAll('-', '')}`;
    await client.connect();
    try {
        await client.query('BEGIN');
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET LOCAL search_path TO "${schema}"`);
        await client.query(`CREATE TABLE funcionario (id INTEGER PRIMARY KEY);
            INSERT INTO funcionario VALUES (1), (2);
            CREATE TABLE turma (id INTEGER PRIMARY KEY, profissional_id INTEGER NOT NULL,
                status TEXT NOT NULL, deleted_at TIMESTAMPTZ,
                CONSTRAINT turma_profissional_id_fkey FOREIGN KEY (profissional_id) REFERENCES funcionario(id));
            CREATE INDEX turma_profissional_id_idx ON turma(profissional_id);
            INSERT INTO turma VALUES (10, 1, 'ATIVO', NULL), (20, 2, 'INATIVO', NULL), (30, 1, 'INATIVO', NOW());`);
        const sql = readFileSync(join(__dirname, '../../prisma/migrations/20261123000000_multiplos_profissionais_turma/migration.sql'), 'utf8');
        await client.query(sql.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, ''));
        const { rows } = await client.query('SELECT turma_id, profissional_id, data_inicio, data_fim FROM turma_profissional ORDER BY turma_id');
        assert.deepEqual(rows, [10, 20, 30].map((turma_id) => ({ turma_id, profissional_id: turma_id === 20 ? 2 : 1, data_inicio: null, data_fim: null })));
        await client.query('SAVEPOINT duplicacao');
        await assert.rejects(() => client.query('INSERT INTO turma_profissional (turma_id, profissional_id) VALUES (10, 1)'), { code: '23505' });
        await client.query('ROLLBACK TO SAVEPOINT duplicacao');
        await client.query("UPDATE turma_profissional SET data_fim = '2026-11-01' WHERE turma_id = 10");
        await client.query("INSERT INTO turma_profissional (turma_id, profissional_id, data_inicio) VALUES (10, 1, '2026-11-02'), (10, 2, '2026-11-02')");
        assert.equal((await client.query('SELECT count(*)::int AS total FROM turma_profissional WHERE turma_id = 10')).rows[0].total, 3);
        await client.query('SAVEPOINT exclusao');
        await assert.rejects(() => client.query('DELETE FROM funcionario WHERE id = 1'), (erro) => ['23001', '23503'].includes(erro.code));
        await client.query('ROLLBACK TO SAVEPOINT exclusao');
        assert.equal((await client.query("SELECT count(*)::int AS total FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'turma' AND column_name = 'profissional_id'", [schema])).rows[0].total, 0);
    } finally {
        await client.query('ROLLBACK');
        await client.end();
    }
});
