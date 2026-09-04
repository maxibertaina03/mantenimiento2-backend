-- CreateEnum
CREATE TYPE "ViaEnvioOrden" AS ENUM ('CORREO', 'WHATSAPP');

-- CreateTable
CREATE TABLE "envios_orden" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "via" "ViaEnvioOrden" NOT NULL,
    "destinatarios" TEXT NOT NULL,
    "automatico" BOOLEAN NOT NULL DEFAULT true,
    "enviadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,

    CONSTRAINT "envios_orden_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "envios_orden_ordenId_idx" ON "envios_orden"("ordenId");

-- CreateIndex
CREATE INDEX "envios_orden_enviadoEn_idx" ON "envios_orden"("enviadoEn");

-- AddForeignKey
ALTER TABLE "envios_orden" ADD CONSTRAINT "envios_orden_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios_orden" ADD CONSTRAINT "envios_orden_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
