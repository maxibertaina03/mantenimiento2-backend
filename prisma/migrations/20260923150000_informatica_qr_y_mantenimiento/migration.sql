-- Equipos de informática: etiqueta QR y mantenimiento.
--
-- Solo AGREGA columnas, todas opcionales. No toca ninguna fila existente.

-- Cuándo se imprimió la etiqueta, igual que en materiales y equipos de planta.
ALTER TABLE "equipos_it" ADD COLUMN "qrGeneradoEn" TIMESTAMP(3);

-- Una orden de trabajo, una tarea y una rutina pueden ser sobre una PC en vez
-- de sobre una máquina de planta. Son dos columnas y no una porque son dos
-- tablas distintas: el dominio exige que venga una o la otra, nunca las dos.
ALTER TABLE "ordenes_trabajo" ADD COLUMN "equipoItId" TEXT;
ALTER TABLE "tareas_programadas" ADD COLUMN "equipoItId" TEXT;
ALTER TABLE "rutinas_tarea" ADD COLUMN "equipoItId" TEXT;

CREATE INDEX "ordenes_trabajo_equipoItId_idx" ON "ordenes_trabajo"("equipoItId");
CREATE INDEX "tareas_programadas_equipoItId_idx" ON "tareas_programadas"("equipoItId");
CREATE INDEX "rutinas_tarea_equipoItId_idx" ON "rutinas_tarea"("equipoItId");

-- SET NULL: si se da de baja una PC, el trabajo que se le hizo sigue habiéndose
-- hecho. Lo que se gastó no se borra con la ficha.
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_equipoItId_fkey" FOREIGN KEY ("equipoItId") REFERENCES "equipos_it"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tareas_programadas" ADD CONSTRAINT "tareas_programadas_equipoItId_fkey" FOREIGN KEY ("equipoItId") REFERENCES "equipos_it"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rutinas_tarea" ADD CONSTRAINT "rutinas_tarea_equipoItId_fkey" FOREIGN KEY ("equipoItId") REFERENCES "equipos_it"("id") ON DELETE SET NULL ON UPDATE CASCADE;
