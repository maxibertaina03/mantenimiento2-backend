-- Responsables de equipos de IT, y marca/modelo/ubicación como catálogos.
--
-- Esta migración NO es la que generó Prisma. La de Prisma borraba las columnas
-- viejas y con ellas los datos: quién tenía cada equipo, de qué marca era y
-- dónde estaba. Acá los datos se trasladan ANTES de borrar nada.
--
-- Orden: crear lo nuevo, llenarlo con lo viejo, recién entonces borrar lo viejo.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Lo nuevo
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "responsables" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "sector" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "usuarioId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "responsables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "responsables_usuarioId_key" ON "responsables"("usuarioId");
CREATE INDEX "responsables_activo_idx" ON "responsables"("activo");

ALTER TABLE "responsables" ADD CONSTRAINT "responsables_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipos_it"
  ADD COLUMN "marcaId" TEXT,
  ADD COLUMN "modeloId" TEXT,
  ADD COLUMN "ubicacionId" TEXT,
  ADD COLUMN "responsableId" TEXT;

ALTER TABLE "asignaciones_equipo_it" ADD COLUMN "responsableId" TEXT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Trasladar los datos
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Responsables ───────────────────────────────────────────────────────────
-- Un responsable por cada usuario que hoy figure como tal. El enlace a
-- `usuarioId` se usa acá como puente para saber a quién corresponde cada uno, y
-- más abajo se corta para los que no entran al sistema.
INSERT INTO "responsables" ("id", "nombre", "activo", "usuarioId", "creadoEn", "actualizadoEn")
SELECT gen_random_uuid(), u."nombre", true, u."id", now(), now()
FROM "usuarios" u
WHERE EXISTS (SELECT 1 FROM "equipos_it" e WHERE e."asignadoAId" = u."id")
   OR EXISTS (SELECT 1 FROM "asignaciones_equipo_it" a WHERE a."usuarioId" = u."id");

UPDATE "equipos_it" e SET "responsableId" = r."id"
FROM "responsables" r WHERE r."usuarioId" = e."asignadoAId";

UPDATE "asignaciones_equipo_it" a SET "responsableId" = r."id"
FROM "responsables" r WHERE r."usuarioId" = a."usuarioId";

-- Se corta el puente para los que NO entran al sistema, que son casi todos:
-- tenían un correo inventado terminado en @sin-acceso.local y un rol que nunca
-- usaron. Los cuatro que sí entran quedan enlazados.
UPDATE "responsables" r SET "usuarioId" = NULL
FROM "usuarios" u WHERE u."id" = r."usuarioId" AND u."idExterno" IS NULL;

-- ── Ubicaciones ────────────────────────────────────────────────────────────
-- Se comparan sin mayúsculas y sin acentos, porque Postgres no tiene la
-- extensión `unaccent` y en los datos conviven "Recepcion" con "Recepción" y
-- "Oficina deposito" con "Oficina Deposito". `translate` alcanza para las
-- vocales acentuadas y la eñe, que es todo lo que aparece.
INSERT INTO "ubicaciones_equipo" ("id", "nombre", "orden", "activo", "creadoEn", "actualizadoEn")
SELECT gen_random_uuid(), x."nombre", 0, true, now(), now()
FROM (
  SELECT DISTINCT ON (lower(translate(trim(e."ubicacion"), 'áéíóúÁÉÍÓÚàèìòùäëïöüñÑ', 'aeiouAEIOUaeiouaeiounN')))
         trim(e."ubicacion") AS "nombre"
  FROM "equipos_it" e
  WHERE nullif(trim(e."ubicacion"), '') IS NOT NULL
) x
WHERE NOT EXISTS (
  SELECT 1 FROM "ubicaciones_equipo" u
  WHERE lower(translate(u."nombre", 'áéíóúÁÉÍÓÚàèìòùäëïöüñÑ', 'aeiouAEIOUaeiouaeiounN'))
      = lower(translate(x."nombre", 'áéíóúÁÉÍÓÚàèìòùäëïöüñÑ', 'aeiouAEIOUaeiouaeiounN'))
);

UPDATE "equipos_it" e SET "ubicacionId" = u."id"
FROM "ubicaciones_equipo" u
WHERE lower(translate(u."nombre", 'áéíóúÁÉÍÓÚàèìòùäëïöüñÑ', 'aeiouAEIOUaeiouaeiounN'))
    = lower(translate(trim(e."ubicacion"), 'áéíóúÁÉÍÓÚàèìòùäëïöüñÑ', 'aeiouAEIOUaeiouaeiounN'));

-- ── Marcas ─────────────────────────────────────────────────────────────────
-- "Intel" y "AMD" no son marcas del equipo, son el procesador: la importación
-- los metió en la columna equivocada. El campo `procesador` está vacío en todos
-- los equipos, así que moverlos ahí recupera un dato en vez de perderlo.
UPDATE "equipos_it"
SET "procesador" = COALESCE("procesador", trim("marca"))
WHERE lower(trim("marca")) IN ('intel', 'amd');

-- "Sin especificar" tampoco es una marca: es la forma larga de decir que no se
-- sabe. Una fila de catálogo que dice eso es un null con pasos de más.
-- "Tp Link" y "Tplink" son la misma marca escrita de dos formas.
INSERT INTO "marcas_equipo" ("id", "nombre", "orden", "activo", "creadoEn", "actualizadoEn")
SELECT gen_random_uuid(), m."nombre", 0, true, now(), now()
FROM (
  SELECT DISTINCT
    CASE WHEN lower(replace(trim(e."marca"), ' ', '')) = 'tplink' THEN 'TP-Link'
         ELSE trim(e."marca") END AS "nombre"
  FROM "equipos_it" e
  WHERE nullif(trim(e."marca"), '') IS NOT NULL
    AND lower(trim(e."marca")) NOT IN ('sin especificar', 'intel', 'amd')
) m
WHERE NOT EXISTS (
  SELECT 1 FROM "marcas_equipo" x WHERE lower(x."nombre") = lower(m."nombre")
);

UPDATE "equipos_it" e SET "marcaId" = m."id"
FROM "marcas_equipo" m
WHERE lower(trim(e."marca")) NOT IN ('sin especificar', 'intel', 'amd')
  AND lower(m."nombre") = lower(
        CASE WHEN lower(replace(trim(e."marca"), ' ', '')) = 'tplink' THEN 'TP-Link'
             ELSE trim(e."marca") END);

-- ── Marcas que el propio registro delata ───────────────────────────────────
-- Estas no son suposiciones mías: cada una está escrita en los datos.

-- Las cámaras Tapo son TP-Link. Lo prueba esta misma tabla: el modelo "C-100"
-- aparece una vez con la marca "Tp Link" cargada a mano y tres veces sin marca.
UPDATE "equipos_it"
SET "marcaId" = (SELECT "id" FROM "marcas_equipo" WHERE "nombre" = 'TP-Link')
WHERE "marcaId" IS NULL AND trim("modelo") IN ('C-100', 'C-310', 'C-500');

-- Estos dicen la marca en su propio nombre: el equipo se llama "Mikrotik
-- FABRICA" y su modelo es "RB9551G-2HnD".
INSERT INTO "marcas_equipo" ("id", "nombre", "orden", "activo", "creadoEn", "actualizadoEn")
SELECT gen_random_uuid(), 'Mikrotik', 0, true, now(), now()
WHERE EXISTS (SELECT 1 FROM "equipos_it" WHERE "codigoInterno" ILIKE 'Mikrotik%')
  AND NOT EXISTS (SELECT 1 FROM "marcas_equipo" WHERE lower("nombre") = 'mikrotik');

UPDATE "equipos_it"
SET "marcaId" = (SELECT "id" FROM "marcas_equipo" WHERE lower("nombre") = 'mikrotik')
WHERE "marcaId" IS NULL AND "codigoInterno" ILIKE 'Mikrotik%';

-- Galaxy es la línea de Samsung, y Samsung ya está en el catálogo porque cuatro
-- equipos la tenían cargada a mano.
UPDATE "equipos_it"
SET "marcaId" = (SELECT "id" FROM "marcas_equipo" WHERE lower("nombre") = 'samsung')
WHERE "marcaId" IS NULL
  AND trim("modelo") ILIKE 'Galaxy %'
  AND EXISTS (SELECT 1 FROM "marcas_equipo" WHERE lower("nombre") = 'samsung');

-- Los dos Starlink no tienen modelo: "SL-2993040-90059-75" es el número de
-- serie del equipo, distinto en cada uno. Va a su campo, que está vacío, por lo
-- mismo que Intel fue a procesador.
UPDATE "equipos_it"
SET "numeroSerie" = COALESCE("numeroSerie", trim("modelo")),
    "modelo" = ''
WHERE "codigoInterno" ILIKE 'STARLINK%' AND trim("modelo") ILIKE 'SL-%';

-- ── Modelos ────────────────────────────────────────────────────────────────
-- En treinta equipos el "modelo" es el código interno repetido: PC1 tiene
-- modelo "PC1", SERVIDOR 2 tiene modelo "SERVIDOR 2". Eso no es un modelo, y no
-- se pierde nada al no catalogarlo: el valor ya vive en `codigoInterno`.
INSERT INTO "modelos_equipo" ("id", "marcaId", "nombre", "orden", "activo", "creadoEn", "actualizadoEn")
SELECT gen_random_uuid(), x."marcaId", x."nombre", 0, true, now(), now()
FROM (
  SELECT DISTINCT e."marcaId", trim(e."modelo") AS "nombre"
  FROM "equipos_it" e
  WHERE e."marcaId" IS NOT NULL
    AND nullif(trim(e."modelo"), '') IS NOT NULL
    AND lower(trim(e."modelo")) IS DISTINCT FROM lower(trim(COALESCE(e."codigoInterno", '')))
) x
WHERE NOT EXISTS (
  SELECT 1 FROM "modelos_equipo" m
  WHERE m."marcaId" = x."marcaId" AND lower(m."nombre") = lower(x."nombre")
);

UPDATE "equipos_it" e SET "modeloId" = m."id"
FROM "modelos_equipo" m
WHERE m."marcaId" = e."marcaId" AND lower(m."nombre") = lower(trim(e."modelo"));

-- Un modelo de verdad que quedó sin marca no puede entrar al catálogo, porque
-- el modelo cuelga de una marca. En vez de perderlo, se guarda en las notas,
-- que están vacías en todos los equipos. Cuando alguien le ponga la marca, el
-- modelo se carga desde ahí con un clic.
UPDATE "equipos_it" e
SET "notas" = trim(both E'\n' FROM COALESCE(e."notas", '') || E'\nModelo sin marca asignada: ' || trim(e."modelo"))
WHERE e."modeloId" IS NULL
  AND nullif(trim(e."modelo"), '') IS NOT NULL
  AND lower(trim(e."modelo")) IS DISTINCT FROM lower(trim(COALESCE(e."codigoInterno", '')));

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Recién ahora, borrar lo viejo
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "asignaciones_equipo_it" DROP CONSTRAINT "asignaciones_equipo_it_usuarioId_fkey";
ALTER TABLE "equipos_it" DROP CONSTRAINT "equipos_it_asignadoAId_fkey";

DROP INDEX "asignaciones_equipo_it_usuarioId_idx";
DROP INDEX "equipos_it_asignadoAId_idx";

ALTER TABLE "asignaciones_equipo_it" DROP COLUMN "usuarioId";

ALTER TABLE "equipos_it"
  DROP COLUMN "asignadoAId",
  DROP COLUMN "marca",
  DROP COLUMN "modelo",
  DROP COLUMN "ubicacion";

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Índices y claves foráneas de lo nuevo
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX "asignaciones_equipo_it_responsableId_idx" ON "asignaciones_equipo_it"("responsableId");
CREATE INDEX "equipos_it_responsableId_idx" ON "equipos_it"("responsableId");
CREATE INDEX "equipos_it_marcaId_idx" ON "equipos_it"("marcaId");
CREATE INDEX "equipos_it_ubicacionId_idx" ON "equipos_it"("ubicacionId");

ALTER TABLE "equipos_it" ADD CONSTRAINT "equipos_it_marcaId_fkey"
  FOREIGN KEY ("marcaId") REFERENCES "marcas_equipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "equipos_it" ADD CONSTRAINT "equipos_it_modeloId_fkey"
  FOREIGN KEY ("modeloId") REFERENCES "modelos_equipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "equipos_it" ADD CONSTRAINT "equipos_it_ubicacionId_fkey"
  FOREIGN KEY ("ubicacionId") REFERENCES "ubicaciones_equipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "equipos_it" ADD CONSTRAINT "equipos_it_responsableId_fkey"
  FOREIGN KEY ("responsableId") REFERENCES "responsables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asignaciones_equipo_it" ADD CONSTRAINT "asignaciones_equipo_it_responsableId_fkey"
  FOREIGN KEY ("responsableId") REFERENCES "responsables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
