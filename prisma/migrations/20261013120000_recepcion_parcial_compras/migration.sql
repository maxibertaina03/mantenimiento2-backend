-- Recepción parcial de órdenes de compra: una orden puede llegar en varias
-- entregas, reclamarse lo que falta y cerrarse con faltante.
-- Solo agrega: no borra ni modifica ningún dato que ya existía; completa las
-- columnas y tablas nuevas para las órdenes ya recibidas.

-- AlterEnum
ALTER TYPE "EstadoOrdenCompra" ADD VALUE 'RECIBIDA_PARCIAL';

-- AlterTable
ALTER TABLE "envios_orden" ADD COLUMN     "esReclamo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ordenes_compra" ADD COLUMN     "cerradaConFaltante" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "motivoFaltante" TEXT;

-- AlterTable
ALTER TABLE "renglones_orden_compra" ADD COLUMN     "cantidadRecibida" DECIMAL(14,3) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "recepciones_orden" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "remito" TEXT,
    "factura" TEXT,
    "notas" TEXT,
    "recibidaPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recepciones_orden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recepciones_renglon" (
    "id" TEXT NOT NULL,
    "recepcionId" TEXT NOT NULL,
    "renglonId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "movimientoId" TEXT,

    CONSTRAINT "recepciones_renglon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recepciones_orden_ordenId_idx" ON "recepciones_orden"("ordenId");

-- CreateIndex
CREATE UNIQUE INDEX "recepciones_renglon_movimientoId_key" ON "recepciones_renglon"("movimientoId");

-- CreateIndex
CREATE INDEX "recepciones_renglon_recepcionId_idx" ON "recepciones_renglon"("recepcionId");

-- CreateIndex
CREATE INDEX "recepciones_renglon_renglonId_idx" ON "recepciones_renglon"("renglonId");

-- AddForeignKey
ALTER TABLE "recepciones_orden" ADD CONSTRAINT "recepciones_orden_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones_orden" ADD CONSTRAINT "recepciones_orden_recibidaPorId_fkey" FOREIGN KEY ("recibidaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones_renglon" ADD CONSTRAINT "recepciones_renglon_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "recepciones_orden"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones_renglon" ADD CONSTRAINT "recepciones_renglon_renglonId_fkey" FOREIGN KEY ("renglonId") REFERENCES "renglones_orden_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones_renglon" ADD CONSTRAINT "recepciones_renglon_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "movimientos_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Las órdenes que ya se recibieron, contadas igual que las nuevas ──
-- Cada una llegó de una sola vez: una entrega con su fecha, remito y factura,
-- y por renglón lo pedido entero, con el movimiento de ENTRADA que ya tenía.

UPDATE "renglones_orden_compra" AS r
SET "cantidadRecibida" = r."cantidad"
FROM "ordenes_compra" AS o
WHERE o."id" = r."ordenId" AND o."estado" = 'RECIBIDA';

INSERT INTO "recepciones_orden" ("id", "ordenId", "fecha", "remito", "factura", "recibidaPorId", "creadoEn")
SELECT gen_random_uuid()::text, o."id", COALESCE(o."recibidaEn", o."actualizadoEn"), o."remito", o."factura",
       o."recibidaPorId", COALESCE(o."recibidaEn", o."actualizadoEn")
FROM "ordenes_compra" AS o
WHERE o."estado" = 'RECIBIDA';

INSERT INTO "recepciones_renglon" ("id", "recepcionId", "renglonId", "cantidad", "movimientoId")
SELECT gen_random_uuid()::text, ro."id", r."id", r."cantidad", r."movimientoId"
FROM "renglones_orden_compra" AS r
JOIN "recepciones_orden" AS ro ON ro."ordenId" = r."ordenId";
