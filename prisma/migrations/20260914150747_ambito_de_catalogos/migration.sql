-- CreateEnum
CREATE TYPE "AmbitoCatalogo" AS ENUM ('PLANTA', 'IT', 'AMBAS');

-- AlterTable
ALTER TABLE "marcas_equipo" ADD COLUMN     "ambito" "AmbitoCatalogo" NOT NULL DEFAULT 'PLANTA';

-- AlterTable
ALTER TABLE "ubicaciones_equipo" ADD COLUMN     "ambito" "AmbitoCatalogo" NOT NULL DEFAULT 'PLANTA';

-- Los items que ya existian quedan como PLANTA, que es el default: el
-- desplegable de equipos de planta sigue mostrando exactamente lo mismo que
-- mostraba, ni una fila mas.
--
-- A partir de ahi, cada item se marca por el uso REAL que tiene en los datos,
-- no por suposiciones:

-- Una ubicacion que usan equipos de los dos modulos vale para los dos.
UPDATE "ubicaciones_equipo" u SET "ambito" = 'AMBAS'
WHERE EXISTS (SELECT 1 FROM "equipos" e WHERE e."ubicacionId" = u."id")
  AND EXISTS (SELECT 1 FROM "equipos_it" e WHERE e."ubicacionId" = u."id");

-- Una que solo usan equipos de informatica es de informatica. Son las 32 que
-- entraron con la migracion anterior: "Contaduria", "Rack de oficina",
-- "Abajo de las escaleras oficina".
UPDATE "ubicaciones_equipo" u SET "ambito" = 'IT'
WHERE NOT EXISTS (SELECT 1 FROM "equipos" e WHERE e."ubicacionId" = u."id")
  AND EXISTS (SELECT 1 FROM "equipos_it" e WHERE e."ubicacionId" = u."id");

-- Las marcas se reparten igual. Hoy planta no tiene ninguna cargada, asi que
-- todas las que existen vinieron de informatica.
UPDATE "marcas_equipo" m SET "ambito" = 'AMBAS'
WHERE EXISTS (SELECT 1 FROM "equipos" e WHERE e."marcaId" = m."id")
  AND EXISTS (SELECT 1 FROM "equipos_it" e WHERE e."marcaId" = m."id");

UPDATE "marcas_equipo" m SET "ambito" = 'IT'
WHERE NOT EXISTS (SELECT 1 FROM "equipos" e WHERE e."marcaId" = m."id")
  AND EXISTS (SELECT 1 FROM "equipos_it" e WHERE e."marcaId" = m."id");
