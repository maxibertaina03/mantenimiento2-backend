-- Calendario: tareas programadas y rutinas.
--
-- Solo CREA dos tablas. No toca ninguna fila de las que ya están.

CREATE TABLE "rutinas_tarea" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "cadaDias" INTEGER NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3),
    "equipoId" TEXT,
    "asignadoAId" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadaPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rutinas_tarea_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tareas_programadas" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "asignadoAId" TEXT,
    "equipoId" TEXT,
    "planId" TEXT,
    "rutinaId" TEXT,
    "ordenTrabajoId" TEXT,
    "creadaPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tareas_programadas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rutinas_tarea_activa_idx" ON "rutinas_tarea"("activa");
CREATE INDEX "rutinas_tarea_equipoId_idx" ON "rutinas_tarea"("equipoId");

CREATE UNIQUE INDEX "tareas_programadas_ordenTrabajoId_key" ON "tareas_programadas"("ordenTrabajoId");
CREATE INDEX "tareas_programadas_fecha_idx" ON "tareas_programadas"("fecha");
CREATE INDEX "tareas_programadas_estado_idx" ON "tareas_programadas"("estado");
CREATE INDEX "tareas_programadas_asignadoAId_idx" ON "tareas_programadas"("asignadoAId");
CREATE INDEX "tareas_programadas_equipoId_idx" ON "tareas_programadas"("equipoId");

-- Un vencimiento de plan genera UNA tarea, y una repetición de rutina también.
-- Es lo que permite generarlas al abrir el calendario sin duplicar nada: se
-- intenta crear y si ya está, choca y se ignora. Las cargadas a mano tienen los
-- dos en null, y en Postgres los nulos no chocan entre sí.
CREATE UNIQUE INDEX "tareas_programadas_planId_fecha_key" ON "tareas_programadas"("planId", "fecha");
CREATE UNIQUE INDEX "tareas_programadas_rutinaId_fecha_key" ON "tareas_programadas"("rutinaId", "fecha");

ALTER TABLE "rutinas_tarea" ADD CONSTRAINT "rutinas_tarea_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rutinas_tarea" ADD CONSTRAINT "rutinas_tarea_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rutinas_tarea" ADD CONSTRAINT "rutinas_tarea_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tareas_programadas" ADD CONSTRAINT "tareas_programadas_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tareas_programadas" ADD CONSTRAINT "tareas_programadas_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tareas_programadas" ADD CONSTRAINT "tareas_programadas_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- CASCADE: si se borra el plan o la rutina, sus tareas pendientes no tienen
-- sentido. Las que ya se hicieron dejaron su orden de trabajo, que sí queda.
ALTER TABLE "tareas_programadas" ADD CONSTRAINT "tareas_programadas_planId_fkey" FOREIGN KEY ("planId") REFERENCES "planes_mantenimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tareas_programadas" ADD CONSTRAINT "tareas_programadas_rutinaId_fkey" FOREIGN KEY ("rutinaId") REFERENCES "rutinas_tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tareas_programadas" ADD CONSTRAINT "tareas_programadas_ordenTrabajoId_fkey" FOREIGN KEY ("ordenTrabajoId") REFERENCES "ordenes_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
