const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { formatarCalendarioAluno, obterCalendariosExportacaoService, selecionarExportacaoService } = require('./exportacaoCalendarioService');
const { loteExportacaoDTO, filtrosExportacaoDTO } = require('../dtos/exportacaoCalendarioDTO');

const dia = (d) => new Date(`${d}T00:00:00Z`);
const hora = (h) => new Date(`1970-01-01T${h}:00Z`);
const referencia = '2026-11-20T15:00:00Z'; // Meio-dia em Brasília.
function aluno(status = 'ATIVO') {
    return { id: 1, status, turno: 'MANHA', pessoa: { nome: 'Aluno teste' }, dias_frequencia: [5, 1, 3], matriculas_turmas: [], atendimentos_clinicos: [] };
}
function matricula(id, tipo = 'OFICINA', status = 'ATIVO') {
    return { status, data_fim: null, turma: { id, tipo, nome: `Turma ${id}`, turno: 'MANHA', status: 'ATIVO', deleted_at: null,
        ano_letivo: { ano: 2026 }, profissional: { pessoa: { nome: 'Professor teste' } }, ambiente: { nome: 'Sala teste' },
        horarios: [5, 2, 1, 3].map((dia_semana) => ({ dia_semana, hora_inicio: hora('08:15'), hora_fim: hora('09:15') })) } };
}
function sessao(data = '2026-11-20', inicio = '13:00', status = 'ATIVO') {
    return { data_sessao: dia(data), hora_inicio: hora(inicio), status, data_cancelamento: null, profissional_id: 2,
        profissional: { pessoa: { nome: 'Terapeuta da sessão' } }, duracao_minutos: 40 };
}
function atendimento(tipo = 'SEMANAL', status = 'ATIVO') {
    return { id: 3, tipo_recorrencia: tipo, frequencia: 1, status, data_cancelamento: null,
        data_termino: tipo === 'EVENTUAL' ? null : dia('2026-12-31'), modalidade_cadastrada: { nome: 'Psicologia' }, sessoes: [sessao()] };
}

test('grade fixa mantém oficinas nas férias, filtra ano regular e ordena a frequência do aluno', () => {
    const registro = aluno();
    registro.matriculas_turmas = [matricula(1), matricula(2, 'REGULAR'), matricula(3, 'REGULAR')];
    registro.matriculas_turmas[2].turma.ano_letivo.ano = 2025;
    const antes = structuredClone(registro);
    const grade = formatarCalendarioAluno(registro, '2026-01-02T15:00:00Z');
    assert.deepEqual(grade.turmas_regulares.map((t) => t.id), [2]);
    assert.deepEqual(grade.oficinas[0].horarios.map((h) => h.dia_semana), [1, 3, 5]);
    assert.equal(grade.oficinas[0].profissional, 'Professor teste');
    assert.equal(grade.oficinas[0].sala, 'Sala teste');
    assert.deepEqual(registro, antes);
});

test('rascunho inclui provisórios sem cancelamento e ativo não inclui planejamento', () => {
    const registro = aluno('RASCUNHO');
    registro.matriculas_turmas = [matricula(1, 'REGULAR', 'PROVISORIO'), matricula(2, 'OFICINA', 'PROVISORIO'), matricula(3, 'OFICINA', 'PROVISORIO')];
    registro.matriculas_turmas[2].data_fim = dia('2026-12-01');
    registro.atendimentos_clinicos = [atendimento('SEMANAL', 'PROVISORIO')];
    registro.atendimentos_clinicos[0].sessoes = [sessao('2026-11-20', '13:00', 'PROVISORIO')];
    const grade = formatarCalendarioAluno(registro, referencia);
    assert.equal(grade.oficinas.length, 1);
    assert.equal(grade.turmas_regulares[0].provisorio, true);
    assert.equal(grade.atendimentos[0].provisorio, true);
    registro.status = 'ATIVO';
    const ativo = formatarCalendarioAluno(registro, referencia);
    assert.deepEqual([ativo.oficinas, ativo.turmas_regulares, ativo.atendimentos], [[], [], []]);
});

test('turmas indisponíveis, matrículas encerradas e aluno inativo não geram compromissos', () => {
    const registro = aluno();
    registro.matriculas_turmas = [matricula(1), matricula(2), matricula(3), matricula(4), matricula(5)];
    registro.matriculas_turmas[0].turma.status = 'INATIVO';
    registro.matriculas_turmas[1].turma.deleted_at = new Date();
    registro.matriculas_turmas[2].data_fim = dia('2026-11-19');
    registro.matriculas_turmas[3].status = 'INATIVO';
    registro.matriculas_turmas[4].data_fim = dia('2026-11-20');
    assert.deepEqual(formatarCalendarioAluno(registro, referencia).oficinas.map((t) => t.id), [5]);
    registro.status = 'INATIVO';
    registro.atendimentos_clinicos = [atendimento()];
    const grade = formatarCalendarioAluno(registro, referencia);
    assert.deepEqual([grade.oficinas, grade.turmas_regulares, grade.atendimentos], [[], [], []]);
});

test('eventuais passados, em andamento e iniciando agora são excluídos; futuro permanece', () => {
    const registro = aluno();
    registro.atendimentos_clinicos = ['11:00', '11:50', '12:00', '12:01'].map((h, id) => ({ ...atendimento('EVENTUAL'), id, sessoes: [sessao('2026-11-20', h)] }));
    assert.deepEqual(formatarCalendarioAluno(registro, referencia).atendimentos.map((a) => a.hora_inicio), ['12:01']);
});

test('sessões canceladas e atendimentos encerrados são excluídos, inclusive provisórios', () => {
    const registro = aluno('RASCUNHO');
    registro.atendimentos_clinicos = [atendimento(), atendimento(), atendimento('SEMANAL', 'PROVISORIO'), atendimento(), atendimento()];
    registro.atendimentos_clinicos[0].data_termino = dia('2026-11-19');
    registro.atendimentos_clinicos[1].data_cancelamento = new Date();
    registro.atendimentos_clinicos[2].sessoes[0].data_cancelamento = new Date();
    registro.atendimentos_clinicos[3].sessoes[0].status = 'INATIVO';
    registro.atendimentos_clinicos[4].data_termino = dia('2026-11-20');
    assert.equal(formatarCalendarioAluno(registro, referencia).atendimentos.length, 1);
});

test('grade clínica respeita profissional e horário da sessão, sem regenerar recorrência mensal', () => {
    const registro = aluno();
    const clinico = atendimento('MENSAL');
    clinico.sessoes = [sessao('2026-12-20'), sessao('2026-11-21'), { ...sessao('2026-11-23', '14:00'), profissional_id: 9, profissional: { pessoa: { nome: 'Outro profissional' } } }];
    registro.atendimentos_clinicos = [clinico];
    const grade = formatarCalendarioAluno(registro, referencia);
    assert.equal(grade.atendimentos.length, 2);
    assert.equal(grade.atendimentos[0].proxima_data, '2026-11-21');
    assert.deepEqual(grade.atendimentos[0].dias_semana, [6, 7]);
    assert.equal(grade.atendimentos[1].profissional, 'Outro profissional');
    assert.equal(grade.atendimentos[1].hora_inicio, '14:00');
});

test('ano e data de referência são calculados em Brasília na virada do ano', () => {
    const registro = aluno(); registro.matriculas_turmas = [matricula(1, 'REGULAR')];
    const grade = formatarCalendarioAluno(registro, '2027-01-01T01:00:00Z');
    assert.equal(grade.ano, 2026);
    assert.equal(grade.data_referencia, '2026-12-31');
    assert.equal(grade.turmas_regulares.length, 1);
});

test('seleção reutiliza busca por responsável/status, sem limitar aos vinte carregados', async (t) => {
    const original = prisma.$queryRaw;
    t.after(() => { prisma.$queryRaw = original; });
    prisma.$queryRaw = async (sql) => {
        assert.match(sql.text, /aluno_responsavel/);
        assert.match(sql.text, /deleted_at IS NULL/);
        assert.doesNotMatch(sql.text, /LIMIT/);
        assert.ok(sql.values.includes('jose'));
        assert.ok(sql.values.includes('RASCUNHO'));
        return Array.from({ length: 27 }, (_, i) => ({ id: i + 1, nome: `Aluno ${i}` }));
    };
    const selecao = await selecionarExportacaoService({ busca: ' JOSÉ ', status: 'RASCUNHO' });
    assert.equal(selecao.total, 27);
    assert.equal(selecao.alunos.length, 27);
    assert.ok(Number.isFinite(Date.parse(selecao.referencia)));
});

test('lote mantém ordem solicitada e rejeita integralmente se um aluno estiver indisponível', async (t) => {
    const original = prisma.aluno.findMany;
    t.after(() => { prisma.aluno.findMany = original; });
    prisma.aluno.findMany = async (consulta) => {
        assert.equal(consulta.where.deleted_at, null);
        assert.deepEqual(consulta.select.pessoa, { select: { nome: true } });
        return [aluno(), { ...aluno(), id: 2 }];
    };
    assert.deepEqual((await obterCalendariosExportacaoService([2, 1], referencia)).map((a) => a.aluno.id), [2, 1]);
    await assert.rejects(obterCalendariosExportacaoService([1, 3], referencia), { statusCode: 404 });
});

test('DTO rejeita lotes grandes, IDs repetidos, referência inválida e filtros desconhecidos', () => {
    assert.deepEqual(loteExportacaoDTO.parse({ ids: '1,2', referencia }).ids, [1, 2]);
    for (const ids of ['', '1,1', '0', '-1', 'abc', Array.from({ length: 21 }, (_, i) => i + 1).join(',')]) {
        assert.throws(() => loteExportacaoDTO.parse({ ids, referencia }));
    }
    assert.throws(() => loteExportacaoDTO.parse({ ids: '1', referencia: 'hoje' }));
    assert.throws(() => filtrosExportacaoDTO.parse({ status: 'EXCLUIDO' }));
});

test('rotas de exportação respeitam leitura, validam entradas e retornam 404 sem lote parcial', async (t) => {
    const express = require('express');
    const { alunoLeituraRoutes } = require('../routes/alunoRoutes');
    const original = prisma.aluno.findMany, queryOriginal = prisma.$queryRaw;
    t.after(() => { prisma.aluno.findMany = original; prisma.$queryRaw = queryOriginal; });
    prisma.aluno.findMany = async ({ where }) => where.id.in.includes(99) ? [] : [aluno()];
    prisma.$queryRaw = async () => [{ id: 1, nome: 'Aluno teste' }];
    const app = express();
    app.use((req, res, next) => { if (req.get('x-test-role')) req.usuario = { role: req.get('x-test-role') }; next(); });
    app.use('/api', alunoLeituraRoutes);
    const servidor = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    t.after(() => new Promise((resolve) => servidor.close(resolve)));
    const base = `http://127.0.0.1:${servidor.address().port}/api/alunos`;
    for (const [role, status] of [['admin', 200], ['professor', 200], ['outro', 403], [null, 401]]) {
        const resposta = await fetch(`${base}/1/calendario-exportacao`, { headers: role ? { 'x-test-role': role } : {} });
        assert.equal(resposta.status, status);
    }
    const headers = { 'x-test-role': 'professor' };
    const selecao = await fetch(`${base}/exportacao/selecionados?status=ATIVO`, { headers });
    assert.equal(selecao.status, 200);
    assert.equal((await selecao.json()).total, 1);
    const lote = `${base}/exportacao/calendarios?referencia=${encodeURIComponent(referencia)}`;
    assert.equal((await fetch(`${lote}&ids=1`, { headers })).status, 200);
    assert.equal((await fetch(`${lote}&ids=1,99`, { headers })).status, 404);
    assert.equal((await fetch(`${lote}&ids=1,1`, { headers })).status, 400);
    assert.equal((await fetch(`${base}/invalido/calendario-exportacao`, { headers })).status, 400);
});
