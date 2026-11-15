const prisma = require('../prismaClient');

const camposPublicos = {
    id: true, aluno_id: true, usuario_relator_id: true,
    resumo: true, descricao: true, ocorrido_em: true, created_at: true,
    usuario_relator: { select: { id: true, pessoa: { select: { nome: true } } } },
};

function erro(mensagem, statusCode = 404) {
    return Object.assign(new Error(mensagem), { statusCode });
}

function dataHoraBrasilia(instante) {
    const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(instante);
    const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
    return `${valor('year')}-${valor('month')}-${valor('day')}T${valor('hour')}:${valor('minute')}:${valor('second')}`;
}

function ocorridoEm(data, hora) {
    if (data > dataHoraBrasilia(new Date()).slice(0, 10)) {
        throw erro('A data da ocorrência não pode ser futura.', 400);
    }
    const civil = `${data}T${hora}:00`;
    const referencia = Date.parse(`${civil}Z`);
    let instante = new Date(referencia);
    // Calcula o deslocamento pela zona da instituição, inclusive em datas históricas com horário de verão.
    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
        const diferenca = referencia - Date.parse(`${dataHoraBrasilia(instante)}Z`);
        if (!diferenca) return instante;
        instante = new Date(instante.getTime() + diferenca);
    }
    throw erro('O horário informado não existe nessa data no fuso de Brasília.', 400);
}

async function verificarAluno(alunoId) {
    if (!await prisma.aluno.findUnique({ where: { id: alunoId }, select: { id: true } })) {
        throw erro('Aluno não encontrado.');
    }
}

async function listarOcorrenciasService(alunoId) {
    await verificarAluno(alunoId);
    return prisma.ocorrencia_aluno.findMany({ where: { aluno_id: alunoId },
        select: camposPublicos, orderBy: [{ ocorrido_em: 'desc' }, { id: 'desc' }] });
}

async function criarOcorrenciaService(alunoId, usuarioId, dados) {
    await verificarAluno(alunoId);
    return prisma.ocorrencia_aluno.create({ data: {
        aluno_id: alunoId, usuario_relator_id: usuarioId, resumo: dados.resumo,
        descricao: dados.descricao, ocorrido_em: ocorridoEm(dados.data, dados.hora),
    }, select: camposPublicos });
}

async function editarOcorrenciaService(alunoId, ocorrenciaId, dados) {
    const where = { id: ocorrenciaId, aluno_id: alunoId };
    const atual = await prisma.ocorrencia_aluno.findUnique({ where });
    if (!atual) throw erro('Ocorrência não encontrada para este aluno.');
    const data = {};
    for (const campo of ['resumo', 'descricao']) if (dados[campo] !== undefined) data[campo] = dados[campo];
    if (dados.data !== undefined || dados.hora !== undefined) {
        const anterior = dataHoraBrasilia(atual.ocorrido_em);
        data.ocorrido_em = ocorridoEm(dados.data ?? anterior.slice(0, 10), dados.hora ?? anterior.slice(11, 16));
    }
    return prisma.ocorrencia_aluno.update({ where, data, select: camposPublicos });
}

async function excluirOcorrenciaService(alunoId, ocorrenciaId) {
    const resultado = await prisma.ocorrencia_aluno.deleteMany({ where: { id: ocorrenciaId, aluno_id: alunoId } });
    if (!resultado.count) throw erro('Ocorrência não encontrada para este aluno.');
}

module.exports = { listarOcorrenciasService, criarOcorrenciaService, editarOcorrenciaService, excluirOcorrenciaService };
