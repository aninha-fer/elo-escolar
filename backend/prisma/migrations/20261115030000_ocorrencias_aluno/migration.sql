CREATE TABLE "ocorrencia_aluno" (
    "id" SERIAL NOT NULL,
    "aluno_id" INTEGER NOT NULL,
    "usuario_relator_id" INTEGER NOT NULL,
    "resumo" VARCHAR(200) NOT NULL,
    "descricao" TEXT NOT NULL,
    "ocorrido_em" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ocorrencia_aluno_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ocorrencia_aluno_aluno_id_ocorrido_em_idx" ON "ocorrencia_aluno"("aluno_id", "ocorrido_em");
CREATE INDEX "ocorrencia_aluno_usuario_relator_id_idx" ON "ocorrencia_aluno"("usuario_relator_id");
ALTER TABLE "ocorrencia_aluno" ADD CONSTRAINT "ocorrencia_aluno_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ocorrencia_aluno" ADD CONSTRAINT "ocorrencia_aluno_usuario_relator_id_fkey" FOREIGN KEY ("usuario_relator_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
