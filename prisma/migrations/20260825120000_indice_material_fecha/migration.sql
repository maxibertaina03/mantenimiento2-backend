-- Índice compuesto que cubre el orden exacto usado al recalcular el stock de un
-- material (historial completo ordenado por fecha y desempate por creadoEn).
-- Sin él, cada edición de movimiento hace un scan + sort del historial.
CREATE INDEX "movimientos_stock_materialId_fecha_creadoEn_idx"
  ON "movimientos_stock"("materialId", "fecha", "creadoEn");
