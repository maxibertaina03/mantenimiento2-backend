-- Órdenes de trabajo: para qué se usó lo que salió del pañol.
--
-- Escrita a mano y no generada, como el resto de las migraciones de este
-- proyecto: `prisma migrate dev` necesita una shadow database y contra la base
-- real eso la vacía. Acá solo se CREAN dos tablas; no se toca ni una fila de
-- las que ya están.

CREATE TABLE "ordenes_trabajo" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "equipoId" TEXT,
    "abiertaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abiertaPorId" TEXT,
    "resolucion" TEXT,
    "cerradaEn" TIMESTAMP(3),
    "cerradaPorId" TEXT,
    "motivoAnulacion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordenes_trabajo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "materiales_orden_trabajo" (
    "id" TEXT NOT NULL,
    "ordenTrabajoId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "movimientoId" TEXT NOT NULL,
    "registradoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materiales_orden_trabajo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ordenes_trabajo_numero_key" ON "ordenes_trabajo"("numero");
CREATE INDEX "ordenes_trabajo_estado_idx" ON "ordenes_trabajo"("estado");
CREATE INDEX "ordenes_trabajo_equipoId_idx" ON "ordenes_trabajo"("equipoId");
CREATE INDEX "ordenes_trabajo_abiertaEn_idx" ON "ordenes_trabajo"("abiertaEn");
CREATE INDEX "ordenes_trabajo_tipo_idx" ON "ordenes_trabajo"("tipo");

-- Único: un movimiento de stock pertenece a lo sumo a un renglón de una orden.
-- Es la garantía, a nivel base, de que el pañol y la orden no puedan discrepar.
CREATE UNIQUE INDEX "materiales_orden_trabajo_movimientoId_key" ON "materiales_orden_trabajo"("movimientoId");
CREATE INDEX "materiales_orden_trabajo_ordenTrabajoId_idx" ON "materiales_orden_trabajo"("ordenTrabajoId");
CREATE INDEX "materiales_orden_trabajo_materialId_idx" ON "materiales_orden_trabajo"("materialId");

-- SET NULL y no CASCADE: si algún día se borra un equipo, sus órdenes de
-- trabajo siguen existiendo. Lo que se gastó se gastó, y borrar esa historia
-- junto con la ficha dejaría un agujero en el consumo del pañol.
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_abiertaPorId_fkey" FOREIGN KEY ("abiertaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_cerradaPorId_fkey" FOREIGN KEY ("cerradaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CASCADE acá sí: quitar la orden quita sus renglones. El movimiento de stock
-- NO se va con ellos, que es lo correcto: la salida ocurrió de verdad.
ALTER TABLE "materiales_orden_trabajo" ADD CONSTRAINT "materiales_orden_trabajo_ordenTrabajoId_fkey" FOREIGN KEY ("ordenTrabajoId") REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "materiales_orden_trabajo" ADD CONSTRAINT "materiales_orden_trabajo_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "materiales_orden_trabajo" ADD CONSTRAINT "materiales_orden_trabajo_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "movimientos_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "materiales_orden_trabajo" ADD CONSTRAINT "materiales_orden_trabajo_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
