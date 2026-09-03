-- AlterTable
ALTER TABLE "materiales" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "materiales_activo_idx" ON "materiales"("activo");
