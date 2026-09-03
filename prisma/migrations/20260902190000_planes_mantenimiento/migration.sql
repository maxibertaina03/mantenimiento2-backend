-- Planes de mantenimiento: qué se le hace a cada equipo y cada cuánto.
--
-- Agrega una tabla y una columna opcional a intervenciones. NO toca ningún dato
-- existente: la columna nueva nace en NULL, que es lo correcto para las
-- intervenciones ya cargadas (no respondían a ningún plan).

CREATE TABLE "planes_mantenimiento" (
    "id"               TEXT NOT NULL,
    "equipoId"         TEXT NOT NULL,
    "nombre"           TEXT NOT NULL,
    "tareas"           TEXT,
    "periodicidadDias" INTEGER NOT NULL,
    "proximaFecha"     TIMESTAMP(3) NOT NULL,
    "activo"           BOOLEAN NOT NULL DEFAULT true,
    "creadoEn"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "planes_mantenimiento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "planes_mantenimiento_equipoId_idx"     ON "planes_mantenimiento"("equipoId");
-- Cubre la consulta del aviso diario: los que vencen antes de tal fecha.
CREATE INDEX "planes_mantenimiento_proximaFecha_idx" ON "planes_mantenimiento"("proximaFecha");

ALTER TABLE "planes_mantenimiento" ADD CONSTRAINT "planes_mantenimiento_equipoId_fkey"
    FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- El plan al que responde el trabajo. Opcional: una rotura no responde a ninguno.
ALTER TABLE "intervenciones" ADD COLUMN "planId" TEXT;
CREATE INDEX "intervenciones_planId_idx" ON "intervenciones"("planId");

-- SET NULL y no CASCADE: borrar un plan no puede llevarse el registro de los
-- trabajos que se hicieron. El trabajo pasó, exista o no el plan.
ALTER TABLE "intervenciones" ADD CONSTRAINT "intervenciones_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "planes_mantenimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
