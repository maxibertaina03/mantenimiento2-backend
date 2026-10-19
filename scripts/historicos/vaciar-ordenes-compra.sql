-- ═══════════════════════════════════════════════════════════════════════════
-- Vacía el módulo de órdenes de compra para empezar de nuevo.
--
-- Borra TODAS las órdenes con sus renglones y su registro de envíos, y deja el
-- numerador en cero para que la próxima orden sea la OC-2026-0001.
--
-- NO TOCA NADA MÁS. Materiales, stock, movimientos, proveedores, equipos,
-- planes e intervenciones quedan exactamente como estaban.
--
-- SE ABORTA SOLO si alguna orden ya movió stock. Una orden RECIBIDA generó
-- movimientos de ENTRADA, y borrarla dejaría esos movimientos apuntando a un
-- número de orden que ya no existe: el stock seguiría bien, pero nadie podría
-- reconstruir de dónde salió.
--
-- Todo va en UN SOLO bloque a propósito: las tablas temporales no sobreviven al
-- pooler de Supabase, que puede mandar cada sentencia por una conexión distinta.
--
-- Cómo correrlo: Supabase → SQL Editor → pegar TODO → Run.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_ordenes        int;
  v_renglones      int;
  v_envios         int;
  v_recibidas      int;
  v_con_movimiento int;
BEGIN
  SELECT count(*) INTO v_ordenes FROM ordenes_compra;

  IF v_ordenes = 0 THEN
    RAISE NOTICE 'No hay ninguna orden de compra. No hay nada que borrar.';
    RETURN;
  END IF;

  -- ── Chequeos de seguridad ──────────────────────────────────────────────
  SELECT count(*) INTO v_recibidas
  FROM ordenes_compra WHERE estado = 'RECIBIDA';

  SELECT count(*) INTO v_con_movimiento
  FROM renglones_orden_compra WHERE "movimientoId" IS NOT NULL;

  IF v_recibidas > 0 OR v_con_movimiento > 0 THEN
    RAISE EXCEPTION
      'ABORTADO: hay % orden(es) RECIBIDA(s) y % renglón(es) que ya movieron stock. '
      'Borrarlas dejaría movimientos de stock apuntando a órdenes inexistentes. '
      'Si igual querés borrarlas, hay que decidir antes qué hacer con esos movimientos.',
      v_recibidas, v_con_movimiento;
  END IF;

  -- ── Qué se va a borrar ─────────────────────────────────────────────────
  SELECT count(*) INTO v_renglones FROM renglones_orden_compra;
  SELECT count(*) INTO v_envios    FROM envios_orden;

  RAISE NOTICE 'Órdenes a borrar: %', v_ordenes;
  RAISE NOTICE 'Renglones a borrar: %', v_renglones;
  RAISE NOTICE 'Registros de envío a borrar: %', v_envios;

  -- ── Borrado, de la hoja hacia la raíz ──────────────────────────────────
  -- El orden importa aunque las claves foráneas tengan ON DELETE CASCADE:
  -- explícito se lee mejor y no depende de cómo esté definida cada relación.
  DELETE FROM envios_orden;
  DELETE FROM renglones_orden_compra;
  DELETE FROM ordenes_compra;

  -- ── El numerador vuelve a cero ─────────────────────────────────────────
  -- Sin esto la próxima orden sería la OC-2026-0003, y quedaría un hueco que
  -- después nadie sabe explicar.
  DELETE FROM contadores_documento WHERE clave LIKE 'OC-%';

  RAISE NOTICE 'Listo. La próxima orden va a ser la OC-2026-0001.';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verificación: correr esto después para confirmar qué quedó.
-- Las órdenes en 0; todo lo demás igual que antes.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
  (SELECT count(*) FROM ordenes_compra)           AS ordenes,
  (SELECT count(*) FROM renglones_orden_compra)   AS renglones,
  (SELECT count(*) FROM envios_orden)             AS envios,
  (SELECT count(*) FROM contadores_documento
     WHERE clave LIKE 'OC-%')                     AS contadores,
  (SELECT count(*) FROM materiales)               AS materiales_intactos,
  (SELECT count(*) FROM movimientos_stock)        AS movimientos_intactos,
  (SELECT coalesce(sum("stockActual"), 0)
     FROM materiales)                             AS stock_intacto,
  (SELECT count(*) FROM proveedores)              AS proveedores_intactos,
  (SELECT count(*) FROM equipos)                  AS equipos_intactos;
