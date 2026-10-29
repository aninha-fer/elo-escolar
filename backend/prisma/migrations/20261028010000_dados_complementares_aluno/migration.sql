CREATE TYPE "autorizacao_analgesico" AS ENUM ('NENHUM', 'PARACETAMOL', 'DIPIRONA', 'AMBOS');

-- Os campos antigos contêm dados fictícios e não serão transferidos.
ALTER TABLE "aluno"
  DROP COLUMN "nome_responsavel",
  DROP COLUMN "telefone_responsavel",
  ADD COLUMN "participa_procan" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "observacoes" TEXT;

CREATE TABLE "aluno_responsavel" (
  "id" SERIAL NOT NULL,
  "pessoa_id" INTEGER NOT NULL,
  "aluno_id" INTEGER NOT NULL,
  "parentesco" VARCHAR(30),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "aluno_responsavel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "aluno_dados_medicos" (
  "aluno_id" INTEGER NOT NULL,
  "restricao_alimentar" TEXT,
  "autorizado_atividade_fisica" BOOLEAN,
  "usa_medicamento" BOOLEAN,
  "medicamentos_descricao" TEXT,
  "autorizacao_analgesico" "autorizacao_analgesico",
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "aluno_dados_medicos_pkey" PRIMARY KEY ("aluno_id"),
  CONSTRAINT "aluno_dados_medicos_medicamento_check" CHECK (
    "usa_medicamento" IS NOT TRUE OR NULLIF(btrim("medicamentos_descricao"), '') IS NOT NULL
  )
);

CREATE UNIQUE INDEX "aluno_responsavel_aluno_id_pessoa_id_key" ON "aluno_responsavel"("aluno_id", "pessoa_id");
CREATE INDEX "aluno_responsavel_pessoa_id_idx" ON "aluno_responsavel"("pessoa_id");
ALTER TABLE "aluno_responsavel" ADD CONSTRAINT "aluno_responsavel_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "aluno_responsavel" ADD CONSTRAINT "aluno_responsavel_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "aluno_dados_medicos" ADD CONSTRAINT "aluno_dados_medicos_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
