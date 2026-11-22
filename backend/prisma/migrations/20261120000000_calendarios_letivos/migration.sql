BEGIN;

-- Não inventar períodos para anos sem datas aprovadas, inclusive em registros excluídos.
DO $$
DECLARE pendencias text;
BEGIN
  SELECT string_agg(format('turma %s (ano %s)', id, coalesce(ano_letivo::text, 'não informado')), ', ' ORDER BY id)
  INTO pendencias FROM turma
  WHERE (tipo = 'REGULAR' AND ano_letivo IS NULL)
     OR (ano_letivo IS NOT NULL AND ano_letivo NOT IN (2025, 2026, 2027));
  IF pendencias IS NOT NULL THEN
    RAISE EXCEPTION 'Calendários pendentes de definição: %', pendencias;
  END IF;
END $$;

CREATE TABLE "ano_letivo" (
  "id" SERIAL NOT NULL,
  "ano" INTEGER NOT NULL,
  "data_inicio" DATE NOT NULL,
  "data_fim" DATE NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ano_letivo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ano_letivo_datas_check" CHECK (data_fim >= data_inicio),
  CONSTRAINT "ano_letivo_ano_check" CHECK (ano BETWEEN 1 AND 9999)
);
CREATE UNIQUE INDEX "ano_letivo_ano_key" ON "ano_letivo"("ano");
INSERT INTO "ano_letivo" (ano, data_inicio, data_fim) VALUES
  (2026, '2026-02-03', '2026-12-19'),
  (2027, '2027-02-08', '2027-12-18');

ALTER TABLE "turma" ADD COLUMN "ano_letivo_id" INTEGER;
UPDATE "turma" t SET ano_letivo_id = a.id FROM ano_letivo a WHERE a.ano = t.ano_letivo;
ALTER TABLE "turma" ADD CONSTRAINT "turma_ano_letivo_id_fkey"
  FOREIGN KEY ("ano_letivo_id") REFERENCES "ano_letivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "turma" ADD CONSTRAINT "turma_regular_calendario_check" CHECK (tipo <> 'REGULAR' OR ano_letivo_id IS NOT NULL);
CREATE INDEX "turma_ano_letivo_id_idx" ON "turma"("ano_letivo_id");
ALTER TABLE "turma" DROP COLUMN "ano_letivo";

COMMIT;
