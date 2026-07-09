-- CreateTable
CREATE TABLE "ediciones_movimiento" (
    "id" TEXT NOT NULL,
    "movimientoId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "motivo" TEXT NOT NULL,
    "cambios" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ediciones_movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ediciones_movimiento_movimientoId_idx" ON "ediciones_movimiento"("movimientoId");

-- AddForeignKey
ALTER TABLE "ediciones_movimiento" ADD CONSTRAINT "ediciones_movimiento_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "movimientos_stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ediciones_movimiento" ADD CONSTRAINT "ediciones_movimiento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
