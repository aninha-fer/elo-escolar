ALTER TABLE "funcionario" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
ALTER TABLE "usuario"
    ADD COLUMN "deleted_at" TIMESTAMPTZ(3),
    ALTER COLUMN "email" DROP NOT NULL,
    ALTER COLUMN "senha_hash" DROP NOT NULL;

ALTER TABLE "usuario" ADD CONSTRAINT "usuario_credenciais_obrigatorias"
    CHECK ("deleted_at" IS NOT NULL OR ("email" IS NOT NULL AND "senha_hash" IS NOT NULL));
