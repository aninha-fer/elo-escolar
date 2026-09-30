-- CreateEnum
CREATE TYPE "status_aluno" AS ENUM ('RASCUNHO', 'ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "tipo_turma" AS ENUM ('REGULAR', 'OFICINA');

-- CreateEnum
CREATE TYPE "turno_padrao" AS ENUM ('MANHA', 'TARDE');

-- CreateEnum
CREATE TYPE "tipo_recorrencia" AS ENUM ('EVENTUAL', 'SEMANAL', 'MENSAL');

-- CreateEnum
CREATE TYPE "status" AS ENUM ('ATIVO', 'INATIVO');

-- CreateTable
CREATE TABLE "pessoa" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "data_nascimento" DATE,
    "status_geral" "status" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pessoa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aluno" (
    "id" SERIAL NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "nome_responsavel" TEXT,
    "telefone_responsavel" TEXT,
    "turno" "turno_padrao" NOT NULL,
    "participa_almoco" BOOLEAN NOT NULL DEFAULT false,
    "status" "status_aluno" NOT NULL DEFAULT 'RASCUNHO',
    "dias_frequencia" INTEGER[],

    CONSTRAINT "aluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funcionario" (
    "id" SERIAL NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "cargo" TEXT NOT NULL,

    CONSTRAINT "funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambiente" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "status" NOT NULL DEFAULT 'ATIVO',

    CONSTRAINT "ambiente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turma" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "tipo_turma" NOT NULL,
    "capacidade_maxima" INTEGER,
    "turno" "turno_padrao" NOT NULL,
    "ambiente_id" INTEGER NOT NULL,
    "descricao" TEXT,
    "profissional_id" INTEGER NOT NULL,
    "ano_letivo" INTEGER,
    "status" "status" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turma_horario" (
    "id" SERIAL NOT NULL,
    "turma_id" INTEGER NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "hora_inicio" TIME NOT NULL,
    "hora_fim" TIME NOT NULL,

    CONSTRAINT "turma_horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matricula_turma" (
    "id" SERIAL NOT NULL,
    "aluno_id" INTEGER NOT NULL,
    "turma_id" INTEGER NOT NULL,
    "data_inicio" DATE,
    "data_fim" DATE,
    "status" "status" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matricula_turma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimento_clinico" (
    "id" SERIAL NOT NULL,
    "aluno_id" INTEGER NOT NULL,
    "profissional_id" INTEGER NOT NULL,
    "modalidade" TEXT NOT NULL,
    "tipo_recorrencia" "tipo_recorrencia" NOT NULL DEFAULT 'EVENTUAL',
    "data_inicio" DATE NOT NULL,
    "hora_inicio" TIME NOT NULL,
    "duracao_minutos" INTEGER NOT NULL,
    "frequencia" INTEGER,
    "dias_semana" INTEGER[],
    "data_termino" DATE NOT NULL,
    "status" "status" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atendimento_clinico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimento_sessao" (
    "id" SERIAL NOT NULL,
    "atendimento_clinico_id" INTEGER NOT NULL,
    "data_sessao" DATE NOT NULL,
    "hora_inicio" TIME NOT NULL,
    "duracao_minutos" INTEGER NOT NULL,
    "status" "status" NOT NULL DEFAULT 'ATIVO',

    CONSTRAINT "atendimento_sessao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aluno_pessoa_id_key" ON "aluno"("pessoa_id");

-- CreateIndex
CREATE UNIQUE INDEX "funcionario_pessoa_id_key" ON "funcionario"("pessoa_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_pessoa_id_key" ON "usuario"("pessoa_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "turma_ambiente_id_idx" ON "turma"("ambiente_id");

-- CreateIndex
CREATE INDEX "turma_profissional_id_idx" ON "turma"("profissional_id");

-- CreateIndex
CREATE INDEX "turma_horario_turma_id_idx" ON "turma_horario"("turma_id");

-- CreateIndex
CREATE INDEX "matricula_turma_aluno_id_idx" ON "matricula_turma"("aluno_id");

-- CreateIndex
CREATE INDEX "matricula_turma_turma_id_idx" ON "matricula_turma"("turma_id");

-- CreateIndex
CREATE INDEX "atendimento_clinico_aluno_id_idx" ON "atendimento_clinico"("aluno_id");

-- CreateIndex
CREATE INDEX "atendimento_clinico_profissional_id_idx" ON "atendimento_clinico"("profissional_id");

-- CreateIndex
CREATE INDEX "atendimento_sessao_atendimento_clinico_id_idx" ON "atendimento_sessao"("atendimento_clinico_id");

-- AddForeignKey
ALTER TABLE "aluno" ADD CONSTRAINT "aluno_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcionario" ADD CONSTRAINT "funcionario_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turma" ADD CONSTRAINT "turma_ambiente_id_fkey" FOREIGN KEY ("ambiente_id") REFERENCES "ambiente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turma" ADD CONSTRAINT "turma_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "funcionario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turma_horario" ADD CONSTRAINT "turma_horario_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matricula_turma" ADD CONSTRAINT "matricula_turma_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matricula_turma" ADD CONSTRAINT "matricula_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento_clinico" ADD CONSTRAINT "atendimento_clinico_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento_clinico" ADD CONSTRAINT "atendimento_clinico_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "funcionario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento_sessao" ADD CONSTRAINT "atendimento_sessao_atendimento_clinico_id_fkey" FOREIGN KEY ("atendimento_clinico_id") REFERENCES "atendimento_clinico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
