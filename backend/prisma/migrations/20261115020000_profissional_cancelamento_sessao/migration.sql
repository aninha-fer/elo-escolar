BEGIN;

ALTER TABLE "atendimento_sessao" ADD COLUMN "profissional_id" INTEGER,
  ADD COLUMN "data_cancelamento" DATE;

UPDATE "atendimento_sessao" AS s SET "profissional_id" = a."profissional_id",
  "data_cancelamento" = CASE WHEN s."status" = 'INATIVO' THEN a."data_cancelamento" ELSE NULL END
FROM "atendimento_clinico" AS a WHERE a."id" = s."atendimento_clinico_id";

ALTER TABLE "atendimento_sessao" ALTER COLUMN "profissional_id" SET NOT NULL;
ALTER TABLE "atendimento_sessao" ADD CONSTRAINT "atendimento_sessao_profissional_id_fkey"
  FOREIGN KEY ("profissional_id") REFERENCES "funcionario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "atendimento_sessao_profissional_id_idx" ON "atendimento_sessao"("profissional_id");

COMMIT;
