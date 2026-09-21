-- A quién está asignada cada orden de trabajo.
--
-- La columna es NOT NULL y sin default, que normalmente sería imposible sobre
-- una tabla con datos. Acá se puede porque `ordenes_trabajo` está vacía: el
-- módulo se publicó hace horas y la única orden que existió era de prueba. Si
-- alguna vez hubiera filas, esta migración falla en vez de inventarles dueño,
-- que es exactamente lo que tiene que pasar.
ALTER TABLE "ordenes_trabajo" ADD COLUMN "asignadoAId" TEXT NOT NULL;

CREATE INDEX "ordenes_trabajo_asignadoAId_idx" ON "ordenes_trabajo"("asignadoAId");

-- RESTRICT y no SET NULL: si alguien intenta borrar un usuario que tiene
-- trabajos asignados, la base lo frena. Un trabajo sin dueño es justo lo que
-- esta columna existe para impedir.
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
