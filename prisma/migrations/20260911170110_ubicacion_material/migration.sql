-- AlterTable
ALTER TABLE "materiales" ADD COLUMN     "estanteriaId" TEXT,
ADD COLUMN     "fila" INTEGER;

-- CreateTable
CREATE TABLE "estanterias_material" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estanterias_material_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estanterias_material_nombre_key" ON "estanterias_material"("nombre");

-- CreateIndex
CREATE INDEX "materiales_estanteriaId_idx" ON "materiales"("estanteriaId");

-- AddForeignKey
ALTER TABLE "materiales" ADD CONSTRAINT "materiales_estanteriaId_fkey" FOREIGN KEY ("estanteriaId") REFERENCES "estanterias_material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
