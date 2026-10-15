-- CreateTable
CREATE TABLE "tomas_inventario" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "categoriaId" TEXT,
    "estanteriaId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "notas" TEXT,
    "abiertaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abiertaPorId" TEXT,
    "cerradaEn" TIMESTAMP(3),
    "cerradaPorId" TEXT,
    "motivoAnulacion" TEXT,

    CONSTRAINT "tomas_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renglones_toma" (
    "id" TEXT NOT NULL,
    "tomaId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "contado" DECIMAL(14,3),
    "stockAlContar" DECIMAL(14,3),
    "contadoEn" TIMESTAMP(3),
    "contadoPorId" TEXT,
    "resultado" TEXT,
    "movimientoId" TEXT,

    CONSTRAINT "renglones_toma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tomas_inventario_numero_key" ON "tomas_inventario"("numero");

-- CreateIndex
CREATE INDEX "tomas_inventario_estado_idx" ON "tomas_inventario"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "renglones_toma_movimientoId_key" ON "renglones_toma"("movimientoId");

-- CreateIndex
CREATE INDEX "renglones_toma_materialId_idx" ON "renglones_toma"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "renglones_toma_tomaId_materialId_key" ON "renglones_toma"("tomaId", "materialId");

-- AddForeignKey
ALTER TABLE "tomas_inventario" ADD CONSTRAINT "tomas_inventario_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tomas_inventario" ADD CONSTRAINT "tomas_inventario_estanteriaId_fkey" FOREIGN KEY ("estanteriaId") REFERENCES "estanterias_material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tomas_inventario" ADD CONSTRAINT "tomas_inventario_abiertaPorId_fkey" FOREIGN KEY ("abiertaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tomas_inventario" ADD CONSTRAINT "tomas_inventario_cerradaPorId_fkey" FOREIGN KEY ("cerradaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renglones_toma" ADD CONSTRAINT "renglones_toma_tomaId_fkey" FOREIGN KEY ("tomaId") REFERENCES "tomas_inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renglones_toma" ADD CONSTRAINT "renglones_toma_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renglones_toma" ADD CONSTRAINT "renglones_toma_contadoPorId_fkey" FOREIGN KEY ("contadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renglones_toma" ADD CONSTRAINT "renglones_toma_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "movimientos_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

