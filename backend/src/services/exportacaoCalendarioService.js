const prisma = require('../prismaClient');
const { selecionarAlunosFiltrados } = require('./paginacaoService');
const { agoraInstituicao, inicioOcorrencia } = require('./encerramentoAtividade');

const hora = (valor) => valor.toISOString().slice(11, 16);
const data = (valor) => valor?.toISOString().slice(0, 10) ?? null;

async function selecionarExportacaoService(filtros) {
    const alunos = await selecionarAlunosFiltrados(filtros);
    return { alunos, total: alunos.length, referencia: new Date().toISOString() };
}

function statusElegivel(status, rascunho) {
    return status === 'ATIVO' || (rascunho && status === 'PROVISORIO');
}

function formatarCalendarioAluno(aluno, referencia) {
    const agora = agoraInstituicao(new Date(referencia));
    const hoje = new Date(agora); hoje.setUTCHours(0, 0, 0, 0);
    const frequencia = new Set(aluno.dias_frequencia);
    const rascunho = aluno.status === 'RASCUNHO';
    const resultado = { aluno: { id: aluno.id, nome: aluno.pessoa.nome, status: aluno.status, turno: aluno.turno },
        data_referencia: data(hoje), ano: hoje.getUTCFullYear(), oficinas: [], turmas_regulares: [], atendimentos: [] };
    if (aluno.status === 'INATIVO') return resultado;

    for (const matricula of aluno.matriculas_turmas) {
        const turma = matricula.turma;
        if (!statusElegivel(matricula.status, rascunho) || turma.status !== 'ATIVO' || turma.deleted_at
            || (matricula.status === 'PROVISORIO' && matricula.data_fim)
            || (matricula.data_fim && matricula.data_fim < hoje)) continue;
        if (turma.tipo === 'REGULAR' && turma.ano_letivo?.ano !== resultado.ano) continue;
        const item = { id: turma.id, nome: turma.nome, turno: turma.turno, provisorio: matricula.status === 'PROVISORIO',
            profissional: turma.profissional.pessoa.nome, sala: turma.ambiente?.nome ?? 'Não informada',
            horarios: turma.horarios.filter((h) => frequencia.has(h.dia_semana)).map((h) => ({ dia_semana: h.dia_semana,
                inicio: hora(h.hora_inicio), fim: hora(h.hora_fim) })).sort((a, b) => a.dia_semana - b.dia_semana || a.inicio.localeCompare(b.inicio)) };
        if (!item.horarios.length) continue;
        (turma.tipo === 'REGULAR' ? resultado.turmas_regulares : resultado.oficinas).push(item);
    }

    for (const atendimento of aluno.atendimentos_clinicos) {
        if (!statusElegivel(atendimento.status, rascunho) || atendimento.data_cancelamento
            || (atendimento.tipo_recorrencia !== 'EVENTUAL' && (!atendimento.data_termino || atendimento.data_termino < hoje))) continue;
        const grupos = new Map();
        for (const sessao of atendimento.sessoes) {
            if (!statusElegivel(sessao.status, rascunho) || sessao.data_cancelamento || inicioOcorrencia(sessao.data_sessao, sessao.hora_inicio) <= agora.getTime()) continue;
            const chave = `${sessao.profissional_id}:${hora(sessao.hora_inicio)}:${sessao.duracao_minutos}:${sessao.status}`;
            const grupo = grupos.get(chave) ?? { id: atendimento.id, modalidade: atendimento.modalidade_cadastrada.nome,
                profissional: sessao.profissional.pessoa.nome, dias_semana: [], hora_inicio: hora(sessao.hora_inicio),
                duracao_minutos: sessao.duracao_minutos, tipo_recorrencia: atendimento.tipo_recorrencia, frequencia: atendimento.frequencia,
                proxima_data: data(sessao.data_sessao), data_termino: data(atendimento.data_termino),
                provisorio: atendimento.status === 'PROVISORIO' || sessao.status === 'PROVISORIO' };
            grupo.dias_semana = [...new Set([...grupo.dias_semana, sessao.data_sessao.getUTCDay() || 7])].sort((a, b) => a - b);
            if (data(sessao.data_sessao) < grupo.proxima_data) grupo.proxima_data = data(sessao.data_sessao);
            grupos.set(chave, grupo);
        }
        resultado.atendimentos.push(...grupos.values());
    }
    for (const itens of [resultado.oficinas, resultado.turmas_regulares]) itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.id - b.id);
    resultado.atendimentos.sort((a, b) => a.proxima_data.localeCompare(b.proxima_data) || a.hora_inicio.localeCompare(b.hora_inicio) || a.id - b.id);
    return resultado;
}

async function obterCalendariosExportacaoService(ids, referencia = new Date().toISOString()) {
    const hoje = agoraInstituicao(new Date(referencia)); hoje.setUTCHours(0, 0, 0, 0);
    const alunos = await prisma.aluno.findMany({
        where: { id: { in: ids }, deleted_at: null },
        select: {
            id: true, status: true, turno: true, dias_frequencia: true, pessoa: { select: { nome: true } },
            matriculas_turmas: { where: { status: { in: ['ATIVO', 'PROVISORIO'] } }, select: {
                status: true, data_fim: true, turma: { select: { id: true, nome: true, tipo: true, turno: true, status: true, deleted_at: true,
                    ano_letivo: { select: { ano: true } }, ambiente: { select: { nome: true } },
                    profissional: { select: { pessoa: { select: { nome: true } } } },
                    horarios: { select: { dia_semana: true, hora_inicio: true, hora_fim: true } },
                } },
            } },
            atendimentos_clinicos: { where: { status: { in: ['ATIVO', 'PROVISORIO'] }, data_cancelamento: null,
                OR: [{ tipo_recorrencia: 'EVENTUAL' }, { data_termino: { gte: hoje } }] }, select: {
                id: true, status: true, data_cancelamento: true, data_termino: true, tipo_recorrencia: true, frequencia: true,
                modalidade_cadastrada: { select: { nome: true } },
                sessoes: { where: { status: { in: ['ATIVO', 'PROVISORIO'] }, data_cancelamento: null, data_sessao: { gte: hoje } },
                    select: { profissional_id: true, status: true, data_cancelamento: true, data_sessao: true, hora_inicio: true, duracao_minutos: true,
                        profissional: { select: { pessoa: { select: { nome: true } } } } } },
            } },
        },
    });
    const porId = new Map(alunos.map((aluno) => [aluno.id, aluno]));
    const ausentes = ids.filter((id) => !porId.has(id));
    if (ausentes.length) throw Object.assign(new Error(`Alunos indisponíveis para exportação: ${ausentes.join(', ')}. Atualize a listagem.`), { statusCode: 404 });
    return ids.map((id) => formatarCalendarioAluno(porId.get(id), referencia));
}

module.exports = { selecionarExportacaoService, obterCalendariosExportacaoService, formatarCalendarioAluno };
