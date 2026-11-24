BEGIN;

CREATE TABLE "turma_profissional" (
    "id" SERIAL NOT NULL,
    "turma_id" INTEGER NOT NULL,
    "profissional_id" INTEGER NOT NULL,
    "data_inicio" DATE,
    "data_fim" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "turma_profissional_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "turma_profissional_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "turma_profissional_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "funcionario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "turma_profissional_turma_id_data_fim_idx" ON "turma_profissional"("turma_id", "data_fim");
CREATE INDEX "turma_profissional_profissional_id_data_fim_idx" ON "turma_profissional"("profissional_id", "data_fim");
-- Um profissional pode retornar à turma, mas só pode ter um vínculo aberto.
CREATE UNIQUE INDEX "turma_profissional_vinculo_aberto_key" ON "turma_profissional"("turma_id", "profissional_id") WHERE "data_fim" IS NULL;

-- A estrutura anterior não registrava o início da atuação do profissional.
INSERT INTO "turma_profissional" ("turma_id", "profissional_id")
SELECT "id", "profissional_id" FROM "turma";

ALTER TABLE "turma" DROP CONSTRAINT "turma_profissional_id_fkey";
DROP INDEX "turma_profissional_id_idx";
ALTER TABLE "turma" DROP COLUMN "profissional_id";

COMMIT;
