-- Unidad de medida: de texto libre a catálogo.
--
-- Con texto libre "lt", "Lt" y "litros" son tres unidades distintas y cualquier
-- reporte que agrupe por unidad da números que no cierran. Esta migración crea
-- el catálogo, pasa los materiales a una FK y no pierde ningún valor cargado.
--
-- Al momento de escribirla los 831 materiales tenían la unidad vacía (se perdió
-- en la importación de los listados viejos), así que el backfill no tiene nada
-- que mapear. Igual se escribe para el caso general: si alguien cargó unidades
-- entre hoy y el deploy, se conservan.

-- 1) El catálogo.
CREATE TABLE "unidades_medida" (
    "id"            TEXT NOT NULL,
    "nombre"        TEXT NOT NULL,
    "simbolo"       TEXT NOT NULL,
    "orden"         INTEGER NOT NULL DEFAULT 0,
    "activo"        BOOLEAN NOT NULL DEFAULT true,
    "creadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "unidades_medida_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "unidades_medida_nombre_key"  ON "unidades_medida"("nombre");
CREATE UNIQUE INDEX "unidades_medida_simbolo_key" ON "unidades_medida"("simbolo");

-- 2) Las unidades habituales de un pañol de mantenimiento. El `orden` agrupa
--    por familia (conteo, peso, volumen, longitud, superficie, envases) para
--    que el desplegable no salga alfabético y mezclado.
INSERT INTO "unidades_medida" ("id", "nombre", "simbolo", "orden", "actualizadoEn") VALUES
    (gen_random_uuid()::text, 'Unidad',           'u',   10, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Par',              'par', 20, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Juego',            'jgo', 30, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Kilogramo',        'kg',  40, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Gramo',            'g',   50, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Tonelada',         't',   60, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Litro',            'lt',  70, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Mililitro',        'ml',  80, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Metro',            'm',   90, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Centímetro',       'cm', 100, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Milímetro',        'mm', 110, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Pulgada',          '"',  120, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Metro cuadrado',   'm2', 130, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Metro cúbico',     'm3', 140, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Caja',             'caja',   150, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Bolsa',            'bolsa',  160, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Rollo',            'rollo',  170, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Balde',            'balde',  180, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Bidón',            'bidon',  190, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Tambor',           'tambor', 200, CURRENT_TIMESTAMP);

-- 3) La FK en materiales. Nullable: los materiales importados no traen unidad y
--    no hay ningún valor honesto para inventarles.
ALTER TABLE "materiales" ADD COLUMN "unidadId" TEXT;

-- 4) Cualquier unidad cargada a mano que no esté en el catálogo se da de alta,
--    en vez de perderla. Queda al final del listado (orden 900) para que se vea
--    que hay que revisarla.
INSERT INTO "unidades_medida" ("id", "nombre", "simbolo", "orden", "actualizadoEn")
SELECT gen_random_uuid()::text, sueltas.valor, sueltas.valor, 900, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT btrim("unidad") AS valor FROM "materiales" WHERE btrim("unidad") <> '') AS sueltas
WHERE NOT EXISTS (
    SELECT 1 FROM "unidades_medida" u
    WHERE lower(u."simbolo") = lower(sueltas.valor) OR lower(u."nombre") = lower(sueltas.valor)
);

-- 5) Backfill. Case-insensitive a propósito: "Lt" y "lt" son la misma unidad, y
--    unificarlas es justamente el objetivo de la migración.
UPDATE "materiales" m
SET "unidadId" = u."id"
FROM "unidades_medida" u
WHERE btrim(m."unidad") <> ''
  AND (lower(u."simbolo") = lower(btrim(m."unidad")) OR lower(u."nombre") = lower(btrim(m."unidad")));

-- 6) Ya no queda nada en la columna vieja.
ALTER TABLE "materiales" DROP COLUMN "unidad";

ALTER TABLE "materiales"
    ADD CONSTRAINT "materiales_unidadId_fkey"
    FOREIGN KEY ("unidadId") REFERENCES "unidades_medida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "materiales_unidadId_idx" ON "materiales"("unidadId");
