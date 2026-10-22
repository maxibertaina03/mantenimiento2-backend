-- Registro de los materiales que se cambian de lugar durante una toma de
-- inventario: de dónde a dónde, quién y cuándo. Solo crea una tabla nueva y
-- vacía, con sus claves foráneas: no toca ningún dato existente.

-- CreateTable
CREATE TABLE "reubicaciones_toma" (
    "id" TEXT NOT NULL,
    "tomaId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "estanteriaAnteriorId" TEXT,
    "filaAnterior" INTEGER,
    "estanteriaNuevaId" TEXT,
    "filaNueva" INTEGER,
    "hechaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hechaPorId" TEXT,

    CONSTRAINT "reubicaciones_toma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reubicaciones_toma_tomaId_idx" ON "reubicaciones_toma"("tomaId");

-- AddForeignKey
ALTER TABLE "reubicaciones_toma" ADD CONSTRAINT "reubicaciones_toma_tomaId_fkey" FOREIGN KEY ("tomaId") REFERENCES "tomas_inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reubicaciones_toma" ADD CONSTRAINT "reubicaciones_toma_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reubicaciones_toma" ADD CONSTRAINT "reubicaciones_toma_estanteriaAnteriorId_fkey" FOREIGN KEY ("estanteriaAnteriorId") REFERENCES "estanterias_material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reubicaciones_toma" ADD CONSTRAINT "reubicaciones_toma_estanteriaNuevaId_fkey" FOREIGN KEY ("estanteriaNuevaId") REFERENCES "estanterias_material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reubicaciones_toma" ADD CONSTRAINT "reubicaciones_toma_hechaPorId_fkey" FOREIGN KEY ("hechaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

