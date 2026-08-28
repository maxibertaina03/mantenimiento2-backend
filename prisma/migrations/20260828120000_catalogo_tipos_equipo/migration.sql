-- Los tipos de equipo pasan de enum a catálogo administrable.
-- Agregar un tipo obligaba a tocar el código y migrar; ahora se administra
-- desde el sistema.

-- 1) El catálogo.
CREATE TABLE "tipos_equipo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "alias" TEXT,
    "llevaEspecificaciones" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tipos_equipo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tipos_equipo_nombre_key" ON "tipos_equipo"("nombre");
CREATE INDEX "tipos_equipo_activo_orden_idx" ON "tipos_equipo"("activo", "orden");

-- 2) Los tipos que ya existían, más ISP y Cargador, que hasta ahora caían en
--    "Otro" y quedaban sin clasificar.
--    `clave` es temporal: sirve para mapear el enum viejo y se borra al final.
ALTER TABLE "tipos_equipo" ADD COLUMN "clave" TEXT;

INSERT INTO "tipos_equipo" ("id","nombre","alias","llevaEspecificaciones","orden","actualizadoEn","clave") VALUES
  (gen_random_uuid(),'PC de escritorio','pc escritorio,pc,computadora',true , 10, CURRENT_TIMESTAMP,'PC'),
  (gen_random_uuid(),'Notebook'        ,'notebook,laptop'             ,true , 20, CURRENT_TIMESTAMP,'NOTEBOOK'),
  (gen_random_uuid(),'Servidor'        ,'servidor'                    ,true , 30, CURRENT_TIMESTAMP,'SERVIDOR'),
  (gen_random_uuid(),'Celular'         ,'telefonos,telefono,celular'  ,true , 40, CURRENT_TIMESTAMP,'CELULAR'),
  (gen_random_uuid(),'Tablet'          ,'tablet'                      ,true , 50, CURRENT_TIMESTAMP,'TABLET'),
  (gen_random_uuid(),'Cámara de seguridad','camara de seguridad,camara',false, 60, CURRENT_TIMESTAMP,'CAMARA_SEGURIDAD'),
  (gen_random_uuid(),'Impresora'       ,'impresora'                   ,false, 70, CURRENT_TIMESTAMP,'IMPRESORA'),
  (gen_random_uuid(),'Monitor'         ,'monitor'                     ,false, 80, CURRENT_TIMESTAMP,'MONITOR'),
  (gen_random_uuid(),'Equipo de red'   ,'router/switch,router,switch,access point',false, 90, CURRENT_TIMESTAMP,'EQUIPO_RED'),
  (gen_random_uuid(),'ISP'             ,'isp,starlink,cooperativa'    ,false,100, CURRENT_TIMESTAMP,'ISP'),
  (gen_random_uuid(),'Cargador'        ,'cargadores telefonos,cargador',false,110, CURRENT_TIMESTAMP,'CARGADOR'),
  (gen_random_uuid(),'Otro'            ,'otro'                        ,false,999, CURRENT_TIMESTAMP,'OTRO');

-- 3) Los equipos apuntan al catálogo.
ALTER TABLE "equipos_it" ADD COLUMN "tipoId" TEXT;

UPDATE "equipos_it" e
SET "tipoId" = t."id"
FROM "tipos_equipo" t
WHERE t."clave" = e."tipo"::text;

-- 4) Reclasificar los que estaban en "Otro" por no existir su tipo.
--    Los códigos son inequívocos en este inventario.
UPDATE "equipos_it" e
SET "tipoId" = (SELECT "id" FROM "tipos_equipo" WHERE "clave" = 'CARGADOR')
WHERE e."tipo"::text = 'OTRO' AND e."codigoInterno" ILIKE 'CARGADOR%';

UPDATE "equipos_it" e
SET "tipoId" = (SELECT "id" FROM "tipos_equipo" WHERE "clave" = 'ISP')
WHERE e."tipo"::text = 'OTRO'
  AND (e."codigoInterno" ILIKE 'STARLINK%' OR e."codigoInterno" ILIKE 'COOPERATIVA%');

-- 5) Red de seguridad: si algún equipo quedó sin tipo, va a "Otro" antes de
--    poner la columna como obligatoria.
UPDATE "equipos_it"
SET "tipoId" = (SELECT "id" FROM "tipos_equipo" WHERE "clave" = 'OTRO')
WHERE "tipoId" IS NULL;

ALTER TABLE "equipos_it" ALTER COLUMN "tipoId" SET NOT NULL;
ALTER TABLE "equipos_it" ADD CONSTRAINT "equipos_it_tipoId_fkey"
  FOREIGN KEY ("tipoId") REFERENCES "tipos_equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "equipos_it_tipoId_idx" ON "equipos_it"("tipoId");

-- 6) Fuera el enum y la clave de mapeo.
DROP INDEX IF EXISTS "equipos_it_tipo_idx";
ALTER TABLE "equipos_it" DROP COLUMN "tipo";
ALTER TABLE "tipos_equipo" DROP COLUMN "clave";
DROP TYPE "TipoEquipoIT";
