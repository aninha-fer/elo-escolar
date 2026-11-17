ALTER TABLE "aluno"
    ADD COLUMN "deleted_at" TIMESTAMPTZ(3),
    ALTER COLUMN "turno" DROP NOT NULL,
    ALTER COLUMN "participa_almoco" DROP NOT NULL,
    ALTER COLUMN "participa_procan" DROP NOT NULL;

ALTER TABLE "aluno" ADD CONSTRAINT "aluno_dados_cadastrais_obrigatorios"
    CHECK ("deleted_at" IS NOT NULL OR (
        "turno" IS NOT NULL AND "participa_almoco" IS NOT NULL AND "participa_procan" IS NOT NULL
    ));
