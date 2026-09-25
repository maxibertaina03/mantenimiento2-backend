-- Comprar equipos y herramientas desde una orden de compra.
--
-- Todo es aditivo salvo una cosa, que AFLOJA una restriccion en vez de
-- endurecerla: `materialId` deja de ser obligatorio en los renglones. Ninguna
-- fila existente se toca, porque todas las que hay ya tienen material.
--
-- La clasificacion entra con DEFAULT 'EQUIPO', asi que los 326 equipos que ya
-- estan cargados quedan como equipos, que es lo que son.

-- 1. Equipo o herramienta.
CREATE TYPE "ClasificacionEquipo" AS ENUM ('EQUIPO', 'HERRAMIENTA');

ALTER TABLE "equipos"
  ADD COLUMN "clasificacion" "ClasificacionEquipo" NOT NULL DEFAULT 'EQUIPO';

-- 2. De que compra vino el equipo.
ALTER TABLE "equipos" ADD COLUMN "renglonOrdenCompraId" TEXT;

-- 3. Un renglon puede ser de material O de un equipo.
ALTER TABLE "renglones_orden_compra" ALTER COLUMN "materialId" DROP NOT NULL;

ALTER TABLE "renglones_orden_compra"
  ADD COLUMN "descripcionEquipo" TEXT,
  ADD COLUMN "clasificacion" "ClasificacionEquipo",
  ADD COLUMN "equipoTipoId" TEXT,
  ADD COLUMN "equipoMarcaId" TEXT,
  ADD COLUMN "equipoModeloId" TEXT;

-- 4. Indices y claves foraneas.
CREATE INDEX "equipos_renglonOrdenCompraId_idx" ON "equipos"("renglonOrdenCompraId");
CREATE INDEX "renglones_orden_compra_equipoTipoId_idx" ON "renglones_orden_compra"("equipoTipoId");
CREATE INDEX "renglones_orden_compra_equipoMarcaId_idx" ON "renglones_orden_compra"("equipoMarcaId");
CREATE INDEX "renglones_orden_compra_equipoModeloId_idx" ON "renglones_orden_compra"("equipoModeloId");

-- ON DELETE SET NULL: borrar una orden no puede llevarse puesto el equipo que
-- trajo. El equipo sigue existiendo aunque su compra desaparezca.
ALTER TABLE "equipos"
  ADD CONSTRAINT "equipos_renglonOrdenCompraId_fkey"
  FOREIGN KEY ("renglonOrdenCompraId") REFERENCES "renglones_orden_compra"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "renglones_orden_compra"
  ADD CONSTRAINT "renglones_orden_compra_equipoTipoId_fkey"
  FOREIGN KEY ("equipoTipoId") REFERENCES "tipos_equipo_planta"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "renglones_orden_compra"
  ADD CONSTRAINT "renglones_orden_compra_equipoMarcaId_fkey"
  FOREIGN KEY ("equipoMarcaId") REFERENCES "marcas_equipo"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "renglones_orden_compra"
  ADD CONSTRAINT "renglones_orden_compra_equipoModeloId_fkey"
  FOREIGN KEY ("equipoModeloId") REFERENCES "modelos_equipo"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
