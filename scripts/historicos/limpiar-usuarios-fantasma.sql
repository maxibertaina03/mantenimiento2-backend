-- Borra los usuarios que nunca fueron usuarios.
--
-- La importación original daba de alta como Usuario a cada persona que recibía
-- un equipo de informática, con un correo inventado terminado en
-- `@sin-acceso.local` y un rol que nunca usaba. De 35 usuarios, 31 eran eso.
--
-- Después de la migración a Responsables esos 31 quedaron sin nada: sin equipos,
-- sin historial, sin movimientos, sin órdenes y sin intervenciones. Lo único que
-- hacen es ensuciar la pantalla de Usuarios.
--
-- ESTE SCRIPT ES OPCIONAL. El sistema funciona igual con ellos adentro; esto
-- solo saca la basura. Corrélo cuando quieras, después de verificar que la
-- migración salió bien.
--
-- Cómo correrlo: pegalo en el editor SQL de Supabase, o
--   psql "$DIRECT_URL" -f scripts/limpiar-usuarios-fantasma.sql
--
-- Se aborta solo si encuentra algo que no esperaba. No borra nada a medias:
-- todo pasa dentro de una transacción.

BEGIN;

DO $$
DECLARE
  candidatos INT;
  con_acceso INT;
BEGIN
  -- Los que se van: sin acceso al sistema Y sin una sola relación en ninguna
  -- tabla. Si alguno tuviera aunque sea un movimiento de stock, no entra acá.
  CREATE TEMP TABLE fantasmas ON COMMIT DROP AS
  SELECT u."id", u."nombre", u."email"
  FROM "usuarios" u
  WHERE u."idExterno" IS NULL
    AND u."email" LIKE '%@sin-acceso.local'
    AND NOT EXISTS (SELECT 1 FROM "movimientos_stock" m WHERE m."usuarioId" = u."id")
    AND NOT EXISTS (SELECT 1 FROM "ediciones_movimiento" e WHERE e."usuarioId" = u."id")
    AND NOT EXISTS (SELECT 1 FROM "ordenes_compra" o
                    WHERE o."creadoPorId" = u."id" OR o."recibidaPorId" = u."id")
    AND NOT EXISTS (SELECT 1 FROM "envios_orden" e WHERE e."usuarioId" = u."id")
    AND NOT EXISTS (SELECT 1 FROM "intervenciones" i
                    WHERE i."usuarioId" = u."id" OR i."registradoPorId" = u."id")
    AND NOT EXISTS (SELECT 1 FROM "asignaciones_equipo_it" a WHERE a."registradoPorId" = u."id")
    AND NOT EXISTS (SELECT 1 FROM "responsables" r WHERE r."usuarioId" = u."id")
    AND NOT EXISTS (SELECT 1 FROM "rotaciones_credencial" c WHERE c."rotadaPorId" = u."id")
    AND NOT EXISTS (SELECT 1 FROM "vistas_credencial" v WHERE v."usuarioId" = u."id");

  SELECT count(*) INTO candidatos FROM fantasmas;

  -- Freno de mano: si por lo que sea uno de estos tuviera acceso, se aborta.
  SELECT count(*) INTO con_acceso
  FROM "usuarios" u JOIN fantasmas f ON f."id" = u."id"
  WHERE u."idExterno" IS NOT NULL;

  IF con_acceso > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % usuario(s) de la lista tienen acceso al sistema.', con_acceso;
  END IF;

  RAISE NOTICE 'Se van a borrar % usuario(s) sin acceso y sin ninguna relacion.', candidatos;

  DELETE FROM "usuarios" u USING fantasmas f WHERE u."id" = f."id";

  RAISE NOTICE 'Listo. Quedan % usuario(s).', (SELECT count(*) FROM "usuarios");
END $$;

COMMIT;
