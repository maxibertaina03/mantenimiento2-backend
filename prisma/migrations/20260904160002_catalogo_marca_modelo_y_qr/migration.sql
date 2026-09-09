/*
  Warnings:

  - You are about to drop the column `marca` on the `equipos` table. All the data in the column will be lost.
  - You are about to drop the column `modelo` on the `equipos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "equipos" DROP COLUMN "marca",
DROP COLUMN "modelo",
ADD COLUMN     "marcaId" TEXT,
ADD COLUMN     "modeloId" TEXT;

-- CreateTable
CREATE TABLE "marcas_equipo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marcas_equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelos_equipo" (
    "id" TEXT NOT NULL,
    "marcaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modelos_equipo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marcas_equipo_nombre_key" ON "marcas_equipo"("nombre");

-- CreateIndex
CREATE INDEX "modelos_equipo_marcaId_idx" ON "modelos_equipo"("marcaId");

-- CreateIndex
CREATE UNIQUE INDEX "modelos_equipo_marcaId_nombre_key" ON "modelos_equipo"("marcaId", "nombre");

-- CreateIndex
CREATE INDEX "equipos_marcaId_idx" ON "equipos"("marcaId");

-- CreateIndex
CREATE INDEX "equipos_modeloId_idx" ON "equipos"("modeloId");

-- AddForeignKey
ALTER TABLE "modelos_equipo" ADD CONSTRAINT "modelos_equipo_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "marcas_equipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "marcas_equipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "modelos_equipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
