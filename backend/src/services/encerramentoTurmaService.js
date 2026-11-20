const prisma = require('../prismaClient');
const { agoraInstituicao, fimMatricula } = require('./encerramentoAtividade');
const { bloquearCalendarios, hojeInstituicao, turmaExpirada } = require('./calendarioLetivo');

const filtroMatriculasParaEncerrar = {
    OR: [{ status: 'ATIVO' }, { status: { in: ['PROVISORIO', 'INATIVO'] }, data_fim: null }],
};

async function bloquearTurmaParaEncerramento(tx, id, automatico = false) {
    const matriculas = await tx.matricula_turma.findMany({ where: { turma_id: id, ...filtroMatriculasParaEncerrar }, select: { aluno_id: true } });
    const alunos = new Set(matriculas.map((m) => m.aluno_id));
    // Mantém a ordem aluno → turma usada pelas inscrições e pela edição do aluno.
    for (const alunoId of [...alunos].sort((a, b) => a - b)) await tx.$queryRaw`SELECT "id" FROM "aluno" WHERE "id" = ${alunoId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "turma" WHERE "id" = ${id} FOR UPDATE`;
    const atuais = await tx.matricula_turma.findMany({ where: { turma_id: id, ...filtroMatriculasParaEncerrar } });
    if (atuais.some((m) => !alunos.has(m.aluno_id))) {
        if (automatico) throw Object.assign(new Error('As matrículas mudaram durante o encerramento automático. Tente novamente.'), { statusCode: 409, repetirEncerramento: true });
        throw Object.assign(new Error('As matrículas da turma mudaram. Confira os vínculos e confirme novamente.'), {
            statusCode: 409, confirmacao: { matriculas: atuais.filter((m) => m.status !== 'INATIVO').map((m) => m.id).sort((a, b) => a - b),
                matriculas_ativas: atuais.filter((m) => m.status === 'ATIVO').length },
            matriculas_ativas: atuais.filter((m) => m.status === 'ATIVO').length,
        });
    }
    return atuais;
}

async function encerrarMatriculasTurma(tx, turma, matriculas) {
    const agora = agoraInstituicao();
    const limite = turma.tipo === 'REGULAR' ? turma.ano_letivo?.data_fim : undefined;
    for (const matricula of matriculas) {
        const data_fim = fimMatricula({ ...matricula, turma }, agora, limite);
        const status = matricula.status === 'PROVISORIO' ? 'PROVISORIO' : 'INATIVO';
        if (status === matricula.status && +data_fim === +matricula.data_fim) continue;
        await tx.matricula_turma.update({ where: { id: matricula.id }, data: { data_fim, status } });
    }
}

async function sincronizarTurmasExpiradas({ turmaIds, alunoIds } = {}) {
    const escopos = [
        ...(turmaIds?.length ? [{ id: { in: turmaIds } }] : []),
        ...(alunoIds?.length ? [{ matriculas: { some: { aluno_id: { in: alunoIds }, ...filtroMatriculasParaEncerrar } } }] : []),
    ];
    if ((turmaIds !== undefined || alunoIds !== undefined) && !escopos.length) return;
    const candidatas = await prisma.turma.findMany({ where: {
        tipo: 'REGULAR', status: 'ATIVO', deleted_at: null,
        ano_letivo: { data_fim: { lt: hojeInstituicao() } },
        ...(escopos.length ? { OR: escopos } : {}),
    }, select: { id: true }, orderBy: { id: 'asc' } });
    for (const { id } of candidatas) {
        for (let tentativa = 0; tentativa < 2; tentativa++) {
            try {
                await prisma.$transaction(async (tx) => {
                    await bloquearCalendarios(tx);
                    const matriculas = await bloquearTurmaParaEncerramento(tx, id, true);
                    const turma = await tx.turma.findUnique({ where: { id }, include: { ano_letivo: true, horarios: true } });
                    if (!turma || turma.deleted_at || turma.status !== 'ATIVO' || !turmaExpirada(turma)) return;
                    await encerrarMatriculasTurma(tx, turma, matriculas);
                    await tx.turma.update({ where: { id }, data: { status: 'INATIVO' } });
                }, { isolationLevel: 'ReadCommitted' });
                break;
            } catch (error) {
                if (!error.repetirEncerramento || tentativa === 1) throw error;
            }
        }
    }
}

module.exports = { filtroMatriculasParaEncerrar, bloquearTurmaParaEncerramento, encerrarMatriculasTurma, sincronizarTurmasExpiradas };
