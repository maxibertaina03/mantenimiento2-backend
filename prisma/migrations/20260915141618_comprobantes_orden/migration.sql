-- CreateEnum
CREATE TYPE "TipoComprobante" AS ENUM ('REMITO', 'FACTURA', 'OTRO');

-- CreateTable
CREATE TABLE "comprobantes_orden" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "tipo" "TipoComprobante" NOT NULL DEFAULT 'REMITO',
    "nombre" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subidoPorId" TEXT,

    CONSTRAINT "comprobantes_orden_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comprobantes_orden_ordenId_idx" ON "comprobantes_orden"("ordenId");

-- AddForeignKey
ALTER TABLE "comprobantes_orden" ADD CONSTRAINT "comprobantes_orden_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_orden" ADD CONSTRAINT "comprobantes_orden_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
