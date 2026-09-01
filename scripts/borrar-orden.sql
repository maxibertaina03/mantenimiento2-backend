-- ═══════════════════════════════════════════════════════════════════════════
-- Borrar UNA orden de compra.
--
-- El sistema solo deja eliminar órdenes en BORRADOR: una emitida o recibida ya
-- le fue enviada al proveedor y su registro es la constancia de eso. Este
-- script es la salida para las órdenes de prueba, que no documentan nada.
--
-- CÓMO USARLO: cambiá el número en la línea del `v_numero` y pegá TODO en el
-- SQL Editor de Supabase.
--
-- Va en un solo bloque DO a propósito. Postgres ejecuta un DO como una única
-- sentencia, así que o pasa todo o no pasa nada, sin depender de que el editor
-- respete un BEGIN/COMMIT escrito a mano ni de tablas temporales: el editor de
-- Supabase usa conexiones agrupadas y una tabla temporal puede no existir en la
-- sentencia siguiente.
--
-- ⚠ NO borra una orden que ya sumó stock. Eso dejaría movimientos huérfanos:
--   el inventario tendría una entrada que no responde a ninguna orden. El
--   script se detiene solo si detecta ese caso.
--
-- NO toca `materiales` ni `movimientos_stock`.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- ─────────── El número de la orden a borrar ───────────
  v_numero        TEXT := 'OC-2026-0001';
  -- ──────────────────────────────────────────────────────
  v_id            TEXT;
  v_estado        TEXT;
  v_renglones     INT;
  v_con_movimiento INT;
  v_clave         TEXT;
BEGIN
  SELECT id, estado::text INTO v_id, v_estado
  FROM ordenes_compra WHERE numero = v_numero;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No existe ninguna orden con el número %. Revisá el v_numero.', v_numero;
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE "movimientoId" IS NOT NULL)
  INTO v_renglones, v_con_movimiento
  FROM renglones_orden_compra WHERE "ordenId" = v_id;

  RAISE NOTICE 'Orden % (%) con % renglón/es.', v_numero, v_estado, v_renglones;

  -- Freno: si algún renglón generó un movimiento, la orden ya impactó en el
  -- inventario y borrarla dejaría ese movimiento sin origen.
  IF v_con_movimiento > 0 THEN
    RAISE EXCEPTION
      'La orden ya sumó stock (% renglón/es con movimiento). Borrarla dejaría movimientos huérfanos: anulala desde el sistema en vez de borrarla.',
      v_con_movimiento;
  END IF;

  DELETE FROM renglones_orden_compra WHERE "ordenId" = v_id;
  DELETE FROM ordenes_compra WHERE id = v_id;

  -- La numeración vuelve al último número que siga existiendo. Bajarla más
  -- haría que una orden futura repita un número ya usado.
  v_clave := split_part(v_numero, '-', 1) || '-' || split_part(v_numero, '-', 2);
  UPDATE contadores_documento
  SET ultimo = COALESCE(
        (SELECT MAX(SUBSTRING(numero FROM '\d+$')::int)
         FROM ordenes_compra WHERE numero LIKE v_clave || '-%'), 0)
  WHERE clave = v_clave;

  RAISE NOTICE 'Listo: orden % borrada.', v_numero;
END $$;

-- Verificación: correr esto después y revisar que los números cierren.
SELECT
  (SELECT COUNT(*) FROM ordenes_compra)                              AS ordenes,
  (SELECT COUNT(*) FROM renglones_orden_compra)                      AS renglones,
  (SELECT COUNT(*) FROM movimientos_stock)                           AS movimientos_intactos,
  (SELECT COUNT(*) FROM materiales)                                  AS materiales_intactos,
  (SELECT ultimo FROM contadores_documento WHERE clave = 'OC-2026')  AS ultimo_numero_usado;
