const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../prismaClient');
const { matricularOficinasService, cancelarOficinaService } = require('./matriculaService');
const { agendarAtendimentoService } = require('./atendimentoService');
const { criarMatriculasOficinas, cancelarInscricaoOficina } = require('../controllers/matriculaController');
const { obterAgendaAlunoService } = require('./agendaService');
const { obterOficinasService } = require('./alunoService');

function corresponde(registro, filtro) {
    return Object.entries(filtro).every(([campo, esperado]) => {
        if (campo === 'AND') return esperado.every((item) => corresponde(registro, item));
        if (campo === 'OR') return esperado.some((item) => corresponde(registro, item));
        const atual = registro[campo];
        if (esperado === null || typeof esperado !== 'object') return atual === esperado;
        if ('not' in esperado) return atual != null && atual !== esperado.not;
        if ('in' in esperado) return esperado.in.includes(atual);
        if ('lt' in esperado) return atual != null && atual < esperado.lt;
        if ('lte' in esperado) return atual != null && atual <= esperado.lte;
        if ('gte' in esperado) return atual != null && atual >= esperado.gte;
        return atual != null && corresponde(atual, esperado);
    });
}

function selecionar(registro, select) {
    if (!registro) return null;
    return Object.fromEntries(Object.keys(select).map((campo) => [campo, registro[campo]]));
}

const data = (valor) => new Date(`${valor}T00:00:00.000Z`);
const hora = (valor) => new Date(`1970-01-01T${valor}:00.000Z`);
const pedido = { aluno_id: 1, oficinas_ids: [10] };

function oficina(alteracoes = {}) {
    return {
        id: 10, nome: 'Música', tipo: 'OFICINA', status: 'ATIVO', turno: 'MANHA', capacidade_maxima: 10,
        horarios: [{ dia_semana: 1, hora_inicio: hora('09:00'), hora_fim: hora('10:00') }],
        ...alteracoes
    };
}

function sessao(alteracoes = {}) {
    return {
        id: 20, atendimento_clinico_id: 30, status: 'ATIVO', data_sessao: data('2026-11-02'),
        hora_inicio: hora('09:30'), duracao_minutos: 60,
        atendimento_clinico: { aluno_id: 1, status: 'ATIVO', modalidade: 'Fisioterapia' },
        ...alteracoes
    };
}

function simularBanco(t, {
    aluno = { id: 1, status: 'ATIVO', turno: 'MANHA', dias_frequencia: [1, 2, 3, 4, 5, 6, 7] },
    oficinas = [oficina()], sessoes = [], matriculas = [], vagas = [], falharNaMatricula,
    agora = '2026-11-02T12:00:00.000Z'
} = {}) {
    t.mock.timers.enable({ apis: ['Date'], now: new Date(agora) });
    const estado = { transacoes: [], matriculas: [], sessoes: [], atendimentos: [], eventos: [], atualizacoes: new Map() };
    const listarMatriculas = () => [...matriculas, ...estado.matriculas]
        .map((item) => ({ ...item, ...estado.atualizacoes.get(item.id) }));
    estado.listarMatriculas = listarMatriculas;
    let fila = Promise.resolve();
    const original = prisma.$transaction;
    t.after(() => { prisma.$transaction = original; });
    prisma.$transaction = t.mock.fn(async (operacao, opcoes) => {
        assert.equal(opcoes.isolationLevel, 'ReadCommitted');
        const pendentes = { matriculas: [], sessoes: [], atendimentos: [] };
        const atualizacoes = new Map();
        let liberar;
        const tx = {
            $queryRaw: t.mock.fn(async (sql, id) => {
                assert.match(sql.join('?'), /SELECT "id" FROM "aluno" WHERE "id" = \? FOR UPDATE/);
                assert.equal(id, 1);
                const anterior = fila;
                fila = new Promise((resolve) => { liberar = resolve; });
                await anterior;
                estado.eventos.push('bloqueio');
                return [];
            }),
            aluno: { findUnique: t.mock.fn(async () => {
                estado.eventos.push('aluno');
                return aluno;
            }) },
            turma: { findMany: t.mock.fn(async ({ where }) => oficinas.filter((item) =>
                where.id.in.includes(item.id) && item.tipo === where.tipo && item.status === where.status)) },
            matricula_turma: {
                groupBy: t.mock.fn(async ({ where }) => {
                    if (vagas.length) return vagas;
                    const contagem = new Map();
                    for (const item of listarMatriculas().filter((registro) => corresponde(registro, where))) {
                        contagem.set(item.turma_id, (contagem.get(item.turma_id) || 0) + 1);
                    }
                    return [...contagem].map(([turma_id, total]) => ({ turma_id, _count: { turma_id: total } }));
                }),
                findMany: t.mock.fn(async ({ where }) => listarMatriculas().filter((item) => corresponde(item, where))),
                findFirst: t.mock.fn(async ({ where, select }) => selecionar(
                    listarMatriculas().find((item) => corresponde(item, where)), select)),
                update: t.mock.fn(async ({ where, data: mudancas, select }) => {
                    const registro = listarMatriculas().find((item) => item.id === where.id);
                    assert.ok(registro);
                    atualizacoes.set(registro.id, mudancas);
                    return selecionar({ ...registro, ...mudancas }, select);
                }),
                create: t.mock.fn(async ({ data: registro }) => {
                    if (pendentes.matriculas.length + 1 === falharNaMatricula) throw new Error('Falha ao gravar matrícula');
                    const nova = { id: 100 + pendentes.matriculas.length, data_fim: null,
                        ...registro, turma: oficinas.find((item) => item.id === registro.turma_id) };
                    pendentes.matriculas.push(nova);
                    return nova;
                })
            },
            atendimento_sessao: {
                findMany: t.mock.fn(async ({ where }) => [...sessoes, ...estado.sessoes].filter((item) =>
                    item.status === where.status &&
                    item.atendimento_clinico.aluno_id === where.atendimento_clinico.aluno_id &&
                    item.atendimento_clinico.status === where.atendimento_clinico.status &&
                    (!where.data_sessao || item.data_sessao <= where.data_sessao.lte))),
                createMany: t.mock.fn(async ({ data: registros }) => {
                    pendentes.sessoes.push(...registros.map((registro, indice) => ({
                        id: 200 + indice, ...registro,
                        atendimento_clinico: pendentes.atendimentos.find((item) => item.id === registro.atendimento_clinico_id)
                    })));
                    return { count: registros.length };
                })
            },
            atendimento_clinico: {
                create: t.mock.fn(async ({ data: registro }) => {
                    const novo = { id: 300 + pendentes.atendimentos.length, ...registro };
                    pendentes.atendimentos.push(novo);
                    return novo;
                }),
                findUnique: t.mock.fn(async ({ where }) => ({
                    ...pendentes.atendimentos.find((item) => item.id === where.id), sessoes: pendentes.sessoes
                }))
            }
        };
        estado.transacoes.push(tx);
        try {
            const resultado = await operacao(tx);
            for (const chave of ['matriculas', 'sessoes', 'atendimentos']) estado[chave].push(...pendentes[chave]);
            for (const [id, mudancas] of atualizacoes) estado.atualizacoes.set(id, mudancas);
            return resultado;
        } finally {
            liberar?.();
        }
    });
    return estado;
}

async function verificarConflito(operacao, codigo) {
    let conflito;
    await assert.rejects(operacao, (erro) => {
        assert.equal(erro.isConflict, true);
        conflito = erro.detalhes.find((item) => item.codigo === codigo);
        assert.ok(conflito, `Conflito esperado: ${codigo}`);
        return true;
    });
    return conflito;
}

function verificarSemGravacao(banco) {
    assert.equal(banco.matriculas.length, 0);
    assert.equal(banco.transacoes[0].matricula_turma.create.mock.callCount(), 0);
}

test('matricula oficina livre após bloquear o aluno e consultar suas sessões', async (t) => {
    const banco = simularBanco(t);
    const resultado = await matricularOficinasService(pedido);
    assert.equal(resultado.matriculas.length, 1);
    assert.deepEqual(banco.eventos, ['bloqueio', 'aluno']);
    assert.equal(banco.matriculas[0].data_inicio.toISOString(), '2026-11-02T00:00:00.000Z');
    assert.equal(banco.transacoes[0].atendimento_sessao.findMany.mock.callCount(), 1);
});

for (const tipo of ['EVENTUAL', 'SEMANAL', 'MENSAL']) {
    test(`impede matrícula sobre sessão de atendimento ${tipo}`, async (t) => {
        const registro = sessao();
        registro.atendimento_clinico.tipo_recorrencia = tipo;
        const banco = simularBanco(t, { sessoes: [registro] });
        const conflito = await verificarConflito(() => matricularOficinasService(pedido), 'CHOQUE_HORARIO_ATENDIMENTO');
        assert.equal(conflito.oficina_nome, 'Música');
        assert.equal(conflito.detalhes.sessao_id, 20);
        assert.equal(conflito.detalhes.atendimento_id, 30);
        assert.equal(conflito.detalhes.modalidade, 'Fisioterapia');
        assert.equal(conflito.detalhes.data_sessao, '2026-11-02');
        assert.equal(conflito.detalhes.hora_inicio, '09:30');
        assert.equal(conflito.detalhes.hora_fim, '10:30');
        verificarSemGravacao(banco);
    });
}

for (const [inicio, duracao] of [['08:30', 60], ['09:00', 60], ['09:15', 15], ['08:00', 180]]) {
    test(`detecta sobreposição com sessão às ${inicio}, de ${duracao} minutos`, async (t) => {
        simularBanco(t, { sessoes: [sessao({ hora_inicio: hora(inicio), duracao_minutos: duracao })] });
        await verificarConflito(() => matricularOficinasService(pedido), 'CHOQUE_HORARIO_ATENDIMENTO');
    });
}

test('verifica sessões futuras fora da semana atual', async (t) => {
    simularBanco(t, { sessoes: [sessao({ data_sessao: data('2027-01-04') })] });
    const conflito = await verificarConflito(() => matricularOficinasService(pedido), 'CHOQUE_HORARIO_ATENDIMENTO');
    assert.equal(conflito.detalhes.data_oficina, '2027-01-04');
});

test('ignora sessões encerradas antes da vigência e sessões em outro dia da semana', async (t) => {
    const banco = simularBanco(t, { sessoes: [
        sessao({ data_sessao: data('2026-10-26') }), sessao({ data_sessao: data('2026-11-03') })
    ] });
    await matricularOficinasService(pedido);
    assert.equal(banco.matriculas.length, 1);
});

test('permite horários consecutivos antes e depois da oficina', async (t) => {
    const banco = simularBanco(t, { sessoes: [
        sessao({ hora_inicio: hora('08:00'), duracao_minutos: 60 }), sessao({ hora_inicio: hora('10:00') })
    ] });
    await matricularOficinasService(pedido);
    assert.equal(banco.matriculas.length, 1);
});

test('consulta apenas sessões e atendimentos ativos do aluno', async (t) => {
    const inativo = sessao();
    inativo.atendimento_clinico.status = 'INATIVO';
    const outroAluno = sessao();
    outroAluno.atendimento_clinico.aluno_id = 2;
    const banco = simularBanco(t, { sessoes: [sessao({ status: 'INATIVO' }), inativo, outroAluno] });
    await matricularOficinasService(pedido);
    assert.equal(banco.matriculas.length, 1);
    assert.deepEqual(banco.transacoes[0].atendimento_sessao.findMany.mock.calls[0].arguments[0].where,
        { status: 'ATIVO', atendimento_clinico: { aluno_id: 1, status: 'ATIVO' } });
});

test('não grava nenhuma oficina quando somente uma do lote conflita', async (t) => {
    const banco = simularBanco(t, { oficinas: [oficina(), oficina({ id: 11, nome: 'Artes', horarios: [
        { dia_semana: 2, hora_inicio: hora('09:00'), hora_fim: hora('10:00') }
    ] })], sessoes: [sessao()] });
    await verificarConflito(() => matricularOficinasService({ aluno_id: 1, oficinas_ids: [11, 10] }),
        'CHOQUE_HORARIO_ATENDIMENTO');
    verificarSemGravacao(banco);
});

test('grava todas as oficinas livres na mesma transação', async (t) => {
    const banco = simularBanco(t, { oficinas: [oficina(), oficina({ id: 11, horarios: [
        { dia_semana: 2, hora_inicio: hora('09:00'), hora_fim: hora('10:00') }
    ] })] });
    await matricularOficinasService({ aluno_id: 1, oficinas_ids: [10, 11] });
    assert.equal(banco.matriculas.length, 2);
    assert.equal(prisma.$transaction.mock.callCount(), 1);
});

test('falha na segunda gravação rejeita a transação inteira', async (t) => {
    const banco = simularBanco(t, { falharNaMatricula: 2, oficinas: [oficina(), oficina({ id: 11, horarios: [] })] });
    await assert.rejects(() => matricularOficinasService({ aluno_id: 1, oficinas_ids: [10, 11] }), /Falha ao gravar/);
    assert.equal(banco.matriculas.length, 0);
});

test('considera continuação de sessão iniciada antes da matrícula', async (t) => {
    simularBanco(t, { oficinas: [oficina({ horarios: [
        { dia_semana: 1, hora_inicio: hora('00:30'), hora_fim: hora('01:30') }
    ] })], sessoes: [sessao({ data_sessao: data('2026-11-01'), hora_inicio: hora('23:30'), duracao_minutos: 120 })] });
    const conflito = await verificarConflito(() => matricularOficinasService(pedido), 'CHOQUE_HORARIO_ATENDIMENTO');
    assert.equal(conflito.detalhes.data_oficina, '2026-11-02');
    assert.equal(conflito.detalhes.data_fim, '2026-11-02');
});

test('reconhece oficina noturna em choque com sessão do dia seguinte', async (t) => {
    simularBanco(t, { oficinas: [oficina({ horarios: [
        { dia_semana: 1, hora_inicio: hora('23:30'), hora_fim: hora('01:30') }
    ] })], sessoes: [sessao({ data_sessao: data('2026-11-03'), hora_inicio: hora('00:30') })] });
    await verificarConflito(() => matricularOficinasService(pedido), 'CHOQUE_HORARIO_ATENDIMENTO');
});

test('não projeta oficina em data anterior ao início da matrícula', async (t) => {
    const banco = simularBanco(t, { oficinas: [oficina({ horarios: [
        { dia_semana: 7, hora_inicio: hora('23:30'), hora_fim: hora('01:30') }
    ] })], sessoes: [sessao({ hora_inicio: hora('00:30') })] });
    await matricularOficinasService(pedido);
    assert.equal(banco.matriculas.length, 1);
});

test('usa data civil de São Paulo mesmo quando UTC já mudou de dia', async (t) => {
    const banco = simularBanco(t, { agora: '2026-11-02T01:30:00.000Z' });
    await matricularOficinasService(pedido);
    assert.equal(banco.matriculas[0].data_inicio.toISOString(), '2026-11-01T00:00:00.000Z');
});

for (const [nome, opcoes, codigo] of [
    ['turno', { oficinas: [oficina({ turno: 'TARDE' })] }, 'TURNO_INCOMPATIVEL'],
    ['frequência', { aluno: { id: 1, status: 'ATIVO', turno: 'MANHA', dias_frequencia: [2] } }, 'FREQUENCIA_INSUFICIENTE'],
    ['vagas', { vagas: [{ turma_id: 10, _count: { turma_id: 10 } }] }, 'CAPACIDADE_MAXIMA'],
    ['duplicidade', { matriculas: [{ aluno_id: 1, turma_id: 10, status: 'ATIVO', turma: oficina() }] }, 'MATRICULA_DUPLICADA'],
    ['oficina existente', { matriculas: [{ aluno_id: 1, turma_id: 11, status: 'ATIVO', turma: oficina({ id: 11 }) }] }, 'CHOQUE_HORARIO_OFICINA']
]) {
    test(`preserva validação de ${nome}`, async (t) => {
        const banco = simularBanco(t, opcoes);
        await verificarConflito(() => matricularOficinasService(pedido), codigo);
        verificarSemGravacao(banco);
    });
}

test('preserva bloqueio entre oficinas selecionadas simultâneas', async (t) => {
    simularBanco(t, { oficinas: [oficina(), oficina({ id: 11 })] });
    await verificarConflito(() => matricularOficinasService({ aluno_id: 1, oficinas_ids: [10, 11] }), 'OFICINAS_SIMULTANEAS');
});

test('turma regular pode coincidir com a oficina', async (t) => {
    const banco = simularBanco(t, { matriculas: [{ aluno_id: 1, turma_id: 11, status: 'ATIVO',
        turma: oficina({ id: 11, tipo: 'REGULAR' }) }] });
    await matricularOficinasService(pedido);
    assert.equal(banco.matriculas.length, 1);
});

test('agrega conflito clínico e conflitos existentes', async (t) => {
    simularBanco(t, { sessoes: [sessao()], vagas: [{ turma_id: 10, _count: { turma_id: 10 } }] });
    await assert.rejects(() => matricularOficinasService(pedido), (erro) => {
        assert.deepEqual(new Set(erro.detalhes.map((item) => item.codigo)),
            new Set(['CAPACIDADE_MAXIMA', 'CHOQUE_HORARIO_ATENDIMENTO']));
        return true;
    });
});

for (const primeiro of ['atendimento', 'oficina']) {
    test(`serializa matrícula e atendimento simultâneos, com ${primeiro} primeiro`, async (t) => {
        const banco = simularBanco(t);
        const criarAtendimento = () => agendarAtendimentoService({
            aluno_id: 1, profissional_id: 2, modalidade: 'Fisioterapia', tipo_recorrencia: 'EVENTUAL',
            data_inicio: '2026-11-02', hora_inicio: '09:30', duracao_minutos: 60
        });
        const matricular = () => matricularOficinasService(pedido);
        const operacoes = primeiro === 'atendimento' ? [criarAtendimento, matricular] : [matricular, criarAtendimento];
        const resultados = await Promise.allSettled(operacoes.map((operacao) => operacao()));
        assert.equal(resultados[0].status, 'fulfilled');
        assert.equal(resultados[1].status, 'rejected');
        assert.equal(resultados[1].reason.isConflict, true);
        assert.equal(banco.matriculas.length + banco.atendimentos.length, 1);
    });
}

async function chamarController(body) {
    const resposta = {
        status(codigo) { this.statusCode = codigo; return this; },
        json(conteudo) { this.body = conteudo; return this; }
    };
    await criarMatriculasOficinas({ body }, resposta);
    return resposta;
}

test('controller devolve 409 com detalhes do atendimento clínico', async (t) => {
    simularBanco(t, { sessoes: [sessao()] });
    const resposta = await chamarController(pedido);
    assert.equal(resposta.statusCode, 409);
    assert.equal(resposta.body.conflitos[0].codigo, 'CHOQUE_HORARIO_ATENDIMENTO');
});

test('controller preserva 201 na inscrição livre e 404 para aluno inexistente', async (t) => {
    simularBanco(t);
    assert.equal((await chamarController(pedido)).statusCode, 201);
});

for (const aluno of [null, { id: 1, status: 'INATIVO' }]) {
    test(`controller devolve 404 para aluno ${aluno ? 'inativo' : 'inexistente'}`, async (t) => {
        const banco = simularBanco(t, { aluno });
        assert.equal((await chamarController(pedido)).statusCode, 404);
        verificarSemGravacao(banco);
    });
}

function inscricao(alteracoes = {}) {
    return {
        id: 50, aluno_id: 1, turma_id: 10, status: 'ATIVO',
        data_inicio: data('2026-10-01'), data_fim: null, turma: oficina(), ...alteracoes
    };
}

const cancelamento = { aluno_id: 1, matricula_id: 50 };

test('cancelamento preserva vínculo e início, encerra ontem e não cria matrículas', async (t) => {
    const banco = simularBanco(t, { matriculas: [inscricao()] });
    const { matricula } = await cancelarOficinaService(cancelamento);
    assert.equal(matricula.id, 50);
    assert.equal(matricula.status, 'INATIVO');
    assert.equal(matricula.data_inicio.toISOString(), '2026-10-01T00:00:00.000Z');
    assert.equal(matricula.data_fim.toISOString(), '2026-11-01T00:00:00.000Z');
    assert.deepEqual(banco.eventos, ['bloqueio']);
    assert.equal(banco.matriculas.length, 0);
    assert.deepEqual(banco.atualizacoes.get(50), { status: 'INATIVO', data_fim: data('2026-11-01') });
});

test('repetir cancelamento em outro dia mantém a data original', async (t) => {
    const banco = simularBanco(t, { matriculas: [inscricao()] });
    const primeira = await cancelarOficinaService(cancelamento);
    t.mock.timers.tick(86400000);
    const segunda = await cancelarOficinaService(cancelamento);
    assert.deepEqual(segunda.matricula, primeira.matricula);
    assert.equal(banco.transacoes[1].matricula_turma.update.mock.callCount(), 0);
});

test('cancelamento não estende uma vigência com término anterior', async (t) => {
    simularBanco(t, { matriculas: [inscricao({ data_fim: data('2026-10-30') })] });
    const resultado = await cancelarOficinaService(cancelamento);
    assert.deepEqual(resultado.matricula.data_fim, data('2026-10-30'));
});

test('cancelamento respeita a data de São Paulo na virada de dia UTC', async (t) => {
    simularBanco(t, { matriculas: [inscricao()], agora: '2026-11-02T01:30:00.000Z' });
    assert.deepEqual((await cancelarOficinaService(cancelamento)).matricula.data_fim, data('2026-10-31'));
});

test('inscrição feita e cancelada no mesmo dia fica com período vazio', async (t) => {
    simularBanco(t, { matriculas: [inscricao({ data_inicio: data('2026-11-02') })] });
    const resultado = await cancelarOficinaService(cancelamento);
    assert.ok(resultado.matricula.data_fim < resultado.matricula.data_inicio);
    assert.equal(resultado.matricula.status, 'INATIVO');
});

for (const [nome, registro] of [
    ['outro aluno', inscricao({ aluno_id: 2 })],
    ['turma regular', inscricao({ turma: oficina({ tipo: 'REGULAR' }) })],
    ['matrícula ausente', inscricao({ id: 51 })]
]) {
    test(`cancelamento rejeita ${nome} sem modificar o banco`, async (t) => {
        const banco = simularBanco(t, { matriculas: [registro] });
        await assert.rejects(() => cancelarOficinaService(cancelamento), { statusCode: 404 });
        assert.equal(banco.atualizacoes.size, 0);
        assert.equal(banco.transacoes[0].matricula_turma.update.mock.callCount(), 0);
    });
}

test('é possível encerrar inscrição de aluno que já está inativo', async (t) => {
    simularBanco(t, { aluno: { id: 1, status: 'INATIVO' }, matriculas: [inscricao()] });
    assert.equal((await cancelarOficinaService(cancelamento)).matricula.status, 'INATIVO');
});

test('duas tentativas simultâneas de cancelamento atualizam o vínculo uma vez', async (t) => {
    const banco = simularBanco(t, { matriculas: [inscricao()] });
    const resultados = await Promise.all([
        cancelarOficinaService(cancelamento), cancelarOficinaService(cancelamento)
    ]);
    assert.deepEqual(resultados[0].matricula, resultados[1].matricula);
    assert.equal(banco.transacoes.reduce((total, tx) => total + tx.matricula_turma.update.mock.callCount(), 0), 1);
});

test('cancelamento libera vaga e reinscrição cria outro vínculo sem reabrir o anterior', async (t) => {
    const turma = oficina({ capacidade_maxima: 1 });
    const banco = simularBanco(t, { oficinas: [turma], matriculas: [inscricao({ turma })] });
    await verificarConflito(() => matricularOficinasService(pedido), 'CAPACIDADE_MAXIMA');
    const anterior = await cancelarOficinaService(cancelamento);
    const resultado = await matricularOficinasService(pedido);
    assert.notEqual(resultado.matriculas[0].id, anterior.matricula.id);
    assert.equal(resultado.matriculas[0].status, 'ATIVO');
    assert.deepEqual(banco.atualizacoes.get(50).data_fim, data('2026-11-01'));
    assert.equal(banco.listarMatriculas().filter((item) => item.status === 'ATIVO').length, 1);
});

test('fluxo completo mantém ontem na agenda, remove hoje e permite reinscrição', async (t) => {
    const turma = oficina({ capacidade_maxima: 1, horarios: [1, 2, 3].map((dia) => ({
        id: dia, dia_semana: dia, hora_inicio: hora('09:00'), hora_fim: hora('10:00')
    })) });
    const banco = simularBanco(t, { oficinas: [turma], matriculas: [inscricao({ turma })], agora: '2026-11-03T12:00:00.000Z' });
    function substituir(objeto, metodo, funcao) {
        const original = objeto[metodo];
        t.after(() => { objeto[metodo] = original; });
        objeto[metodo] = t.mock.fn(funcao);
    }
    substituir(prisma.aluno, 'findUnique', async () => ({ id: 1 }));
    substituir(prisma.matricula_turma, 'findMany', async ({ where }) => banco.listarMatriculas()
        .filter((item) => corresponde(item, where)));
    substituir(prisma.atendimento_sessao, 'findMany', async () => []);

    await cancelarOficinaService(cancelamento);
    const encerrada = await obterAgendaAlunoService(1, '2026-11-04');
    assert.deepEqual(encerrada.eventos.map((evento) => [evento.data, evento.matricula_id]), [['2026-11-02', 50]]);
    assert.deepEqual(await obterOficinasService(1), []);

    const { matriculas: [nova] } = await matricularOficinasService(pedido);
    const atualizada = await obterAgendaAlunoService(1, '2026-11-04');
    assert.deepEqual(atualizada.eventos.map((evento) => [evento.data, evento.matricula_id]), [
        ['2026-11-02', 50], ['2026-11-03', nova.id], ['2026-11-04', nova.id]
    ]);
    assert.equal((await obterOficinasService(1))[0].id, nova.id);
});

test('cancelar antes de criar atendimento libera apenas o período posterior', async (t) => {
    simularBanco(t, { matriculas: [inscricao()] });
    const resultados = await Promise.all([
        cancelarOficinaService(cancelamento),
        agendarAtendimentoService({ aluno_id: 1, profissional_id: 2, modalidade: 'Fisioterapia',
            tipo_recorrencia: 'EVENTUAL', data_inicio: '2026-11-02', hora_inicio: '09:30', duracao_minutos: 60 })
    ]);
    assert.equal(resultados[0].matricula.status, 'INATIVO');
    assert.ok(resultados[1].id);
});

async function chamarCancelamento(params = { matricula_id: '50' }, body = { aluno_id: 1 }) {
    const resposta = {
        status(codigo) { this.statusCode = codigo; return this; },
        json(conteudo) { this.body = conteudo; return this; }
    };
    await cancelarInscricaoOficina({ params, body }, resposta);
    return resposta;
}

test('controller de cancelamento responde 200 e devolve o vínculo encerrado', async (t) => {
    simularBanco(t, { matriculas: [inscricao()] });
    const resposta = await chamarCancelamento();
    assert.equal(resposta.statusCode, 200);
    assert.equal(resposta.body.matricula.status, 'INATIVO');
    assert.deepEqual(resposta.body.matricula.data_fim, data('2026-11-01'));
});

for (const [params, body] of [
    [{ matricula_id: 'abc' }, { aluno_id: 1 }], [{ matricula_id: '0' }, { aluno_id: 1 }],
    [{ matricula_id: '50' }, {}], [{ matricula_id: '50' }, { aluno_id: -1 }]
]) {
    test(`controller valida identificadores ${JSON.stringify([params, body])}`, async (t) => {
        const banco = simularBanco(t);
        const resposta = await chamarCancelamento(params, body);
        assert.equal(resposta.statusCode, 400);
        assert.ok(resposta.body.erros.length);
        assert.equal(banco.transacoes.length, 0);
    });
}

test('controller de cancelamento responde 404 para vínculo ausente', async (t) => {
    simularBanco(t);
    assert.equal((await chamarCancelamento()).statusCode, 404);
});
