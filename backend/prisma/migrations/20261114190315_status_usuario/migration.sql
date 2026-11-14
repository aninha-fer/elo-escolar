/*
  Warnings:

  - The `status` column on the `ambiente` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `turma` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "status_simples" AS ENUM ('ATIVO', 'INATIVO');

-- AlterTable
ALTER TABLE "ambiente" DROP COLUMN "status",
ADD COLUMN     "status" "status_simples" NOT NULL DEFAULT 'ATIVO';

-- AlterTable
ALTER TABLE "turma" DROP COLUMN "status",
ADD COLUMN     "status" "status_simples" NOT NULL DEFAULT 'ATIVO';

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "status" "status_simples" NOT NULL DEFAULT 'ATIVO';
