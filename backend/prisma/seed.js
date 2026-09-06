const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  await prisma.ambiente.createMany({
    data: [
      { nome: 'Ginásio' },
      { nome: 'Piscina' },
      { nome: 'Sala de Atendimento 1' },
      { nome: 'Sala de Artesanato' },
      { nome: 'Ar Livre' },
      { nome: 'Salão' },
      { nome: 'Cozinha Experimental' },
      { nome: 'Horta' },
      { nome: 'Audiovisual' },
      { nome: 'Sala Anexa ao Artesanato' },
      { nome: 'Sala 1' },
      { nome: 'Sala 2' },
      { nome: 'Sala 3' },
      { nome: 'Sala 4' }
    ],
    skipDuplicates: true,
  })
  console.log('Ambientes populados com sucesso.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })