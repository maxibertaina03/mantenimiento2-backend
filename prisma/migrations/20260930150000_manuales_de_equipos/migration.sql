-- Los manuales en PDF de los equipos y las herramientas.
--
-- Puramente aditiva: una tabla nueva. No toca ninguna columna ni fila
-- existente. Borrar un equipo se lleva sus manuales (CASCADE), y borrar un
-- usuario deja el manual sin quien lo subio (SET NULL).

CREATE TABLE "manuales_equipo" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subidoPorId" TEXT,

    CONSTRAINT "manuales_equipo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "manuales_equipo_equipoId_idx" ON "manuales_equipo"("equipoId");

ALTER TABLE "manuales_equipo" ADD CONSTRAINT "manuales_equipo_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "manuales_equipo" ADD CONSTRAINT "manuales_equipo_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
