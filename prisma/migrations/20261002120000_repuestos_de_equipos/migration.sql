-- CreateTable
CREATE TABLE "repuestos_equipo" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,3),
    "notas" TEXT,
    "registradoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repuestos_equipo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "repuestos_equipo_materialId_idx" ON "repuestos_equipo"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "repuestos_equipo_equipoId_materialId_key" ON "repuestos_equipo"("equipoId", "materialId");

-- AddForeignKey
ALTER TABLE "repuestos_equipo" ADD CONSTRAINT "repuestos_equipo_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repuestos_equipo" ADD CONSTRAINT "repuestos_equipo_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repuestos_equipo" ADD CONSTRAINT "repuestos_equipo_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

