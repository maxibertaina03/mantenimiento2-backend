-- AlterTable
ALTER TABLE "ordenes_trabajo" ADD COLUMN     "comprobanteExterno" TEXT;

-- CreateTable
CREATE TABLE "envios_orden_trabajo" (
    "id" TEXT NOT NULL,
    "ordenTrabajoId" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "destinatarios" TEXT NOT NULL,
    "automatico" BOOLEAN NOT NULL DEFAULT true,
    "enviadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,

    CONSTRAINT "envios_orden_trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "envios_orden_trabajo_ordenTrabajoId_idx" ON "envios_orden_trabajo"("ordenTrabajoId");

-- AddForeignKey
ALTER TABLE "envios_orden_trabajo" ADD CONSTRAINT "envios_orden_trabajo_ordenTrabajoId_fkey" FOREIGN KEY ("ordenTrabajoId") REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios_orden_trabajo" ADD CONSTRAINT "envios_orden_trabajo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

