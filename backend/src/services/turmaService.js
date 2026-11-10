const prisma = require('../prismaClient');
const { criarTurmaDTO } = require('../dtos/turmaDTO');

async function listarTurmasService(tipo) {
    const filtro = tipo ? { tipo } : {};
    const turmas = await prisma.turma.findMany({
        where: filtro,
        include: {
            horarios: true,
            ambiente: true,
            profissional: {
                include: { pessoa: true }
            },
            _count: {
                select: {
                    matriculas: {
                        where: { status: 'ATIVO' }
                    }
                }
            },
        },
        orderBy: {
            nome: 'asc'
        }
    });
    return turmas.map((turma) => ({
        ...turma,
        vagas_ocupadas: turma._count.matriculas,
        vagas_disponiveis: turma.capacidade_maxima == null ? null : Math.max(turma.capacidade_maxima - turma._count.matriculas, 0),
        _count: undefined,
    }));
}

async function listarTurmasRegularesPorTurnoService(turno) {
    const turmas = await prisma.turma.findMany({
        where: {
            tipo: 'REGULAR',
            ...(turno ? { turno } : {}),
            status: 'ATIVO'
        },
        include: {
            horarios: true,
            ambiente: true,
            profissional: {
                include: { pessoa: true }
            },
            _count: {
                select: {
                    matriculas: {
                        where: { status: 'ATIVO' }
                    }
                }
            },
        },
        orderBy: {
            nome: 'asc'
        }
    });

    return turmas.map((turma) => ({
        ...turma,
        vagas_ocupadas: turma._count.matriculas,
        vagas_disponiveis: turma.capacidade_maxima == null ? null : Math.max(turma.capacidade_maxima - turma._count.matriculas, 0),
        _count: undefined,
    }));
}

async function criarTurmaService(dadosTurma) {
    const dados = criarTurmaDTO.parse(dadosTurma);
    const { tipo, nome, turno, ambiente_id, capacidade_maxima, ano_letivo, descricao, profissional_id } = dados;
    const converterHora = (hora) => new Date(`1970-01-01T${hora}:00.000Z`);
    const dias = tipo === 'REGULAR' ? [1, 2, 3, 4, 5] : [...new Set(dados.dias_semana)].sort((a, b) => a - b);
    const horarios = dias.map((dia_semana) => {
        const manha = turno === 'MANHA' && dia_semana !== 3;
        return {
            dia_semana,
            hora_inicio: converterHora(tipo === 'REGULAR' ? (manha ? '07:30' : '12:30') : dados.hora_inicio),
            hora_fim: converterHora(tipo === 'REGULAR' ? (manha ? '11:30' : '16:30') : dados.hora_fim)
        };
    });

    return prisma.$transaction(async (tx) => {
        const profissional = await tx.funcionario.findUnique({
            where: { id: profissional_id }, select: { cargo: true }
        });
        if (!profissional) {
            throw Object.assign(new Error('Profissional não encontrado.'), { statusCode: 404 });
        }
        const cargosPermitidos = tipo === 'REGULAR' ? ['professor', 'auxiliar'] : ['professor', 'oficineiro'];
        if (!cargosPermitidos.includes(profissional.cargo.trim().toLocaleLowerCase('pt-BR'))) {
            throw Object.assign(new Error(tipo === 'REGULAR'
                ? 'Selecione um professor ou auxiliar para a turma regular.'
                : 'Selecione um professor ou oficineiro para a oficina.'), { statusCode: 400 });
        }
        if (ambiente_id !== undefined) {
            const ambiente = await tx.ambiente.findUnique({ where: { id: ambiente_id }, select: { id: true } });
            if (!ambiente) {
                throw Object.assign(new Error('Sala não encontrada.'), { statusCode: 404 });
            }
        }

        const turma = await tx.turma.create({
            data: {
                nome, tipo, turno, profissional_id,
                capacidade_maxima: capacidade_maxima ?? null,
                ambiente_id: ambiente_id ?? null,
                descricao: descricao || null,
                ano_letivo: ano_letivo ?? null,
                status: 'ATIVO'
            }
        });
        await tx.turma_horario.createMany({
            data: horarios.map((horario) => ({ ...horario, turma_id: turma.id }))
        });
        return tx.turma.findUnique({ where: { id: turma.id }, include: { horarios: true } });
    }, { isolationLevel: 'ReadCommitted' });
}

module.exports = { listarTurmasService, listarTurmasRegularesPorTurnoService, criarTurmaService };
