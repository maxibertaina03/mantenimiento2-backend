-- ═══════════════════════════════════════════════════════════════════════════
-- Borrar UNA orden de compra.
--
-- El sistema solo deja eliminar órdenes en BORRADOR: una emitida o recibida ya
-- le fue enviada al proveedor y su registro es la constancia de eso. Este
-- script es la salida para las órdenes de prueba, que no documentan nada.
--
-- CÓMO USARLO: cambiá el número en la primera línea y pegalo en el SQL Editor
-- de Supabase. Va todo en una transacción: si algo falla, no se aplica nada.
--
-- ⚠ NO borra una orden RECIBIDA que ya sumó stock. Eso dejaría movimientos
--   huérfanos: el stock quedaría con una entrada que no responde a ninguna
--   orden. El script se detiene solo si detecta ese caso.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── El número de la orden a borrar ──────────────────────────────────────────
CREATE TEMP TABLE objetivo ON COMMIT DROP AS
SELECT id, numero, estado FROM ordenes_compra WHERE numero = 'OC-2026-0001';

-- ── Antes ───────────────────────────────────────────────────────────────────
SELECT 'ANTES' AS momento, numero, estado,
       (SELECT COUNT(*) FROM renglones_orden_compra r WHERE r."ordenId" = o.id) AS renglones
FROM objetivo o;

-- ── Freno de seguridad ──────────────────────────────────────────────────────
-- Si algún renglón generó un movimiento de stock, la orden ya impactó en el
-- inventario y borrarla dejaría ese movimiento sin origen.
DO $$
DECLARE con_movimiento INT;
BEGIN
  SELECT COUNT(*) INTO con_movimiento
  FROM renglones_orden_compra r
  JOIN objetivo o ON o.id = r."ordenId"
  WHERE r."movimientoId" IS NOT NULL;

  IF con_movimiento > 0 THEN
    RAISE EXCEPTION
      'La orden ya sumó stock (% renglón/es con movimiento). Borrarla dejaría movimientos huérfanos: anulala desde el sistema en vez de borrarla.',
      con_movimiento;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM objetivo) THEN
    RAISE EXCEPTION 'No existe ninguna orden con ese número. Revisá el número al principio del script.';
  END IF;
END $$;

-- ── Borrado ─────────────────────────────────────────────────────────────────
DELETE FROM renglones_orden_compra WHERE "ordenId" IN (SELECT id FROM objetivo);
DELETE FROM ordenes_compra WHERE id IN (SELECT id FROM objetivo);

-- ── Numeración ──────────────────────────────────────────────────────────────
-- El contador se retrocede solo si la orden borrada era la última del año; si
-- no, bajarlo haría que la próxima orden repita un número ya usado.
UPDATE contadores_documento c
SET ultimo = GREATEST(
      COALESCE((SELECT MAX(SUBSTRING(o.numero FROM '\d+$')::int)
                FROM ordenes_compra o
                WHERE o.numero LIKE c.clave || '-%'), 0),
      0)
WHERE c.clave = 'OC-2026';

-- ── Después ─────────────────────────────────────────────────────────────────
SELECT 'DESPUES' AS momento,
       (SELECT COUNT(*) FROM ordenes_compra)          AS ordenes,
       (SELECT COUNT(*) FROM renglones_orden_compra)  AS renglones,
       (SELECT COUNT(*) FROM movimientos_stock)       AS movimientos,
       (SELECT ultimo FROM contadores_documento WHERE clave = 'OC-2026') AS proximo_numero;

-- Si los números cierran → COMMIT. Si no → ROLLBACK.
COMMIT;
