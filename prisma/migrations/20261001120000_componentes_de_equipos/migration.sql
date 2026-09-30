-- Equipos montados dentro de otros equipos: la electrobomba va en la desnatadora.
--
-- Puramente aditiva. La columna nueva de equipos arranca vacia en todas las
-- filas (ningun equipo esta montado todavia), y la tabla de montajes es nueva.
-- No se toca ningun dato existente.
--
-- Borrar un equipo por error deja sueltos a sus componentes (SET NULL) y se
-- lleva los tramos de montaje donde aparece (CASCADE).

-- AlterTable
ALTER TABLE "equipos" ADD COLUMN     "equipoPadreId" TEXT;

-- CreateTable
CREATE TABLE "montajes_equipo" (
    "id" TEXT NOT NULL,
    "componenteId" TEXT NOT NULL,
    "equipoPadreId" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMP(3),
    "motivo" TEXT,
    "registradoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "montajes_equipo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "montajes_equipo_componenteId_idx" ON "montajes_equipo"("componenteId");

-- CreateIndex
CREATE INDEX "montajes_equipo_equipoPadreId_idx" ON "montajes_equipo"("equipoPadreId");

-- CreateIndex
CREATE INDEX "equipos_equipoPadreId_idx" ON "equipos"("equipoPadreId");

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_equipoPadreId_fkey" FOREIGN KEY ("equipoPadreId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "montajes_equipo" ADD CONSTRAINT "montajes_equipo_componenteId_fkey" FOREIGN KEY ("componenteId") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "montajes_equipo" ADD CONSTRAINT "montajes_equipo_equipoPadreId_fkey" FOREIGN KEY ("equipoPadreId") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "montajes_equipo" ADD CONSTRAINT "montajes_equipo_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

