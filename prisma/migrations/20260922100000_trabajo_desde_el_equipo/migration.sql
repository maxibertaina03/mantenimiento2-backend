-- La orden de trabajo absorbe lo que antes era una "intervención" del equipo.
--
-- Hasta ahora la ficha de una máquina tenía dos historiales: las intervenciones
-- y las órdenes de trabajo. Contestaban la misma pregunta y había que sumar dos
-- tablas para saber cuánto costó mantener algo. La orden pasa a ser el único
-- registro, y para eso necesita los datos que solo tenía la intervención.
--
-- Todo lo que se agrega es opcional o tiene valor por defecto, así que la orden
-- que ya existe queda válida sin tocarla.

-- Cuándo se hizo el trabajo, que no es lo mismo que cuándo se abrió la orden:
-- una orden puede abrirse hoy para registrar algo de la semana pasada.
ALTER TABLE "ordenes_trabajo" ADD COLUMN "fecha" TIMESTAMP(3);
UPDATE "ordenes_trabajo" SET "fecha" = "abiertaEn" WHERE "fecha" IS NULL;
ALTER TABLE "ordenes_trabajo" ALTER COLUMN "fecha" SET NOT NULL;
ALTER TABLE "ordenes_trabajo" ALTER COLUMN "fecha" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ordenes_trabajo" ADD COLUMN "ejecutor" TEXT NOT NULL DEFAULT 'INTERNO';
ALTER TABLE "ordenes_trabajo" ADD COLUMN "proveedorId" TEXT;
ALTER TABLE "ordenes_trabajo" ADD COLUMN "costoManoObra" DECIMAL(14,2);
ALTER TABLE "ordenes_trabajo" ADD COLUMN "horasParada" DECIMAL(8,2);
ALTER TABLE "ordenes_trabajo" ADD COLUMN "planId" TEXT;

CREATE INDEX "ordenes_trabajo_fecha_idx" ON "ordenes_trabajo"("fecha");
CREATE INDEX "ordenes_trabajo_proveedorId_idx" ON "ordenes_trabajo"("proveedorId");
CREATE INDEX "ordenes_trabajo_planId_idx" ON "ordenes_trabajo"("planId");

-- SET NULL en los dos: si se borra un proveedor o un plan, el trabajo que se
-- hizo sigue habiéndose hecho. Lo que se gastó no se borra con la ficha.
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_planId_fkey" FOREIGN KEY ("planId") REFERENCES "planes_mantenimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
