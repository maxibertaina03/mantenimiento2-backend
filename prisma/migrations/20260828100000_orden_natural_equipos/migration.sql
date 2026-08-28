-- Clave para ordenar los equipos como los nombra la gente ("PC2" antes que
-- "PC10"). Se calcula al guardar desde la aplicación; acá se agrega la columna
-- y se completa para los equipos ya cargados.
ALTER TABLE "equipos_it" ADD COLUMN "ordenClave" TEXT;

-- Backfill: prefijo en mayúsculas (sin el número final ni espacios sobrantes)
-- seguido del número relleno con ceros a 10 dígitos.
UPDATE "equipos_it"
SET "ordenClave" =
      upper(btrim(regexp_replace(btrim("codigoInterno"), '[0-9]+$', '')))
   || lpad(coalesce(substring(btrim("codigoInterno") from '([0-9]+)$'), '0'), 10, '0')
WHERE "codigoInterno" IS NOT NULL AND btrim("codigoInterno") <> '';

CREATE INDEX "equipos_it_ordenClave_idx" ON "equipos_it"("ordenClave");
