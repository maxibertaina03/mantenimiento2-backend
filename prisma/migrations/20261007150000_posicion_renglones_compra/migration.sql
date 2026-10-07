-- El lugar de cada renglón en su orden de compra, como se cargó.
-- Solo agrega una columna: no borra ni cambia ningún dato existente.
ALTER TABLE "renglones_orden_compra" ADD COLUMN     "posicion" INTEGER NOT NULL DEFAULT 0;

-- Los renglones que ya existen quedan en el orden en que se venían mostrando
-- (por id), así ninguna orden vieja cambia de aspecto.
UPDATE "renglones_orden_compra" AS r
SET "posicion" = n.posicion
FROM (
  SELECT "id", (ROW_NUMBER() OVER (PARTITION BY "ordenId" ORDER BY "id") - 1)::INTEGER AS posicion
  FROM "renglones_orden_compra"
) AS n
WHERE r."id" = n."id";
