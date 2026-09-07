const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const gerarHorario = (hora) => new Date(`1970-01-01T${hora}:00.000Z`);

async function main() {
  console.log('Limpando banco de dados para o seed...');
  await prisma.turma_horario.deleteMany(); 
  await prisma.matricula_turma.deleteMany(); 
  await prisma.aluno.deleteMany(); 
  await prisma.turma.deleteMany();
  await prisma.ambiente.deleteMany();
  await prisma.funcionario.deleteMany();
  await prisma.pessoa.deleteMany();

  console.log('Populando Ambientes...');
  const ambientesNomes = [
    'Ginásio', 'Piscina', 'Ao ar livre', 'Salão', 'Sala de artesanato', 
    'Cozinha experimental', 'Horta', 'Audiovisual', 'Sala anexa ao artesanato', 
    'Sala bombacha', 'Sala chimarrão', 'Sala piazitos', 'Sala quero-quero'
  ];
  
  const ambientesMap = {};
  for (const nome of ambientesNomes) {
    ambientesMap[nome] = await prisma.ambiente.create({ data: { nome } });
  }

  console.log('Populando Profissionais...');
  const profissionaisNomes = [
    { nome: 'Adriane', cargo: 'Regente' }, { nome: 'Karine', cargo: 'Regente' },
    { nome: 'Sara', cargo: 'Regente' }, { nome: 'Ana', cargo: 'Regente' },
    { nome: 'Magali', cargo: 'Regente' }, { nome: 'Rodrigo', cargo: 'Oficineiro' },
    { nome: 'Gabriel', cargo: 'Oficineiro' }, { nome: 'Pâmela', cargo: 'Oficineiro' },
    { nome: 'Elisete', cargo: 'Oficineiro' }, { nome: 'Ivanice', cargo: 'Oficineiro' },
    { nome: 'Nair', cargo: 'Oficineiro' }, { nome: 'Isac', cargo: 'Oficineiro' },
    { nome: 'Gunter', cargo: 'Oficineiro' }, { nome: 'Michele', cargo: 'Oficineiro' },
    { nome: 'Claudia', cargo: 'Oficineiro' }
  ];

  const profMap = {};
  for (const prof of profissionaisNomes) {
    const pessoa = await prisma.pessoa.create({
      data: { nome: prof.nome, status_geral: 'ATIVO' }
    });
    profMap[prof.nome] = await prisma.funcionario.create({
      data: { pessoa_id: pessoa.id, cargo: prof.cargo }
    });
  }

  console.log('Populando Turmas Regulares e seus Horários...');
  const turmasRegulares = [
    { nome: 'Turma Chimarrão', turno: 'MANHA', prof: 'Adriane', amb: 'Sala chimarrão' },
    { nome: 'Turma Quero Quero', turno: 'MANHA', prof: 'Karine', amb: 'Sala quero-quero' },
    { nome: 'Turma Bombacha', turno: 'MANHA', prof: 'Sara', amb: 'Sala bombacha' },
    { nome: 'Turma Piazitos', turno: 'MANHA', prof: 'Ana', amb: 'Sala piazitos' },
    { nome: 'Turma Chimarrão', turno: 'TARDE', prof: 'Adriane', amb: 'Sala chimarrão' },
    { nome: 'Turma Quero Quero', turno: 'TARDE', prof: 'Karine', amb: 'Sala quero-quero' },
    { nome: 'Turma Bombacha', turno: 'TARDE', prof: 'Sara', amb: 'Sala bombacha' }
  ];

  for (const t of turmasRegulares) {
    const turmaCriada = await prisma.turma.create({
      data: {
        nome: t.nome, tipo: 'REGULAR', turno: t.turno, ano_letivo: 2026,
        capacidade_maxima: 15, profissional_id: profMap[t.prof].id,
        ambiente_id: ambientesMap[t.amb].id
      }
    });

    const hora_inicio = t.turno === 'MANHA' ? gerarHorario('08:00') : gerarHorario('13:00');
    const hora_fim = t.turno === 'MANHA' ? gerarHorario('12:00') : gerarHorario('17:00');

    for (let dia = 1; dia <= 5; dia++) {
      await prisma.turma_horario.create({
        data: {
          turma_id: turmaCriada.id,
          dia_semana: dia,
          hora_inicio: hora_inicio,
          hora_fim: hora_fim
        }
      });
    }
  }

  console.log('Populando Projetos/Oficinas e seus Horários (Matriz de Conflitos)...');
  const oficinas = [
    { nome: 'Educação Física', prof: 'Rodrigo', amb: 'Ginásio', dias: [1, 3] }, // Seg e Qua
    { nome: 'Piscina', prof: 'Rodrigo', amb: 'Piscina', dias: [2, 4] },        // Ter e Qui
    { nome: 'Dança', prof: 'Gabriel', amb: 'Salão', dias: [1, 3] },            // Seg e Qua
    { nome: 'Artesanato', prof: 'Elisete', amb: 'Sala de artesanato', dias: [5] }, // Sexta
    { nome: 'Culinária', prof: 'Nair', amb: 'Cozinha experimental', dias: [2, 4] },// Ter e Qui
    { nome: 'Música', prof: 'Isac', amb: 'Audiovisual', dias: [1, 5] }         // Seg e Sex
  ];

  for (const o of oficinas) {
    const oficinaManha = await prisma.turma.create({
      data: {
        nome: o.nome, tipo: 'OFICINA', turno: 'MANHA', ano_letivo: 2026,
        capacidade_maxima: 10, profissional_id: profMap[o.prof].id,
        ambiente_id: ambientesMap[o.amb].id
      }
    });

    for (const dia of o.dias) {
      await prisma.turma_horario.create({
        data: {
          turma_id: oficinaManha.id, dia_semana: dia,
          hora_inicio: gerarHorario('09:00'), hora_fim: gerarHorario('10:00')
        }
      });
    }

    const oficinaTarde = await prisma.turma.create({
      data: {
        nome: o.nome, tipo: 'OFICINA', turno: 'TARDE', ano_letivo: 2026,
        capacidade_maxima: 10, profissional_id: profMap[o.prof].id,
        ambiente_id: ambientesMap[o.amb].id
      }
    });

    for (const dia of o.dias) {
      await prisma.turma_horario.create({
        data: {
          turma_id: oficinaTarde.id, dia_semana: dia,
          hora_inicio: gerarHorario('14:00'), hora_fim: gerarHorario('15:00')
        }
      });
    }
  }

  console.log('Seed finalizado com sucesso.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });