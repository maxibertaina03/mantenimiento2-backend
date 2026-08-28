-- ═══════════════════════════════════════════════════════════════════════════
-- Dejar la base lista para arrancar a cargar stock en serio.
--
-- BORRA:  movimientos de stock, su auditoría, y las órdenes de compra de prueba.
-- PONE EN 0: el stock de todos los materiales.
-- NO TOCA: materiales, proveedores, equipos IT y sus asignaciones, usuarios,
--          categorías, unidades de medida y tipos de equipo.
--
-- Estado al momento de escribirlo (28/08/2026):
--   831 materiales · 1067 proveedores · 65 equipos IT · 62 asignaciones
--   7 movimientos · 5 órdenes · 8 renglones · 6 materiales con stock ≠ 0
--
-- CÓMO USARLO: pegarlo entero en el SQL Editor de Supabase y ejecutar.
-- Va todo dentro de una transacción: si algo falla, no se aplica nada.
--
-- ⚠ ESTO NO SE PUEDE DESHACER y el plan free de Supabase no tiene backups
--   restaurables. Antes de correrlo, exportá al menos materiales y proveedores
--   (Table Editor → los tres puntitos → Export as CSV). Los movimientos que
--   borres no se recuperan.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Cómo está la base ANTES ──────────────────────────────────────────────
SELECT 'ANTES' AS momento,
       (SELECT COUNT(*) FROM materiales)              AS materiales,
       (SELECT COUNT(*) FROM proveedores)             AS proveedores,
       (SELECT COUNT(*) FROM equipos_it)              AS equipos_it,
       (SELECT COUNT(*) FROM movimientos_stock)       AS movimientos,
       (SELECT COUNT(*) FROM ordenes_compra)          AS ordenes,
       (SELECT COUNT(*) FROM materiales WHERE "stockActual" <> 0) AS con_stock;

-- ── 2. Órdenes de compra ────────────────────────────────────────────────────
-- Van primero porque sus renglones apuntan al movimiento de ENTRADA que generó
-- la recepción. Esa FK no borra en cascada, así que si quedaran órdenes el
-- DELETE de movimientos fallaría.
--
-- Si en algún momento quisieras CONSERVAR las órdenes, no alcanza con saltear
-- este paso: habría que hacer antes
--     UPDATE renglones_orden_compra SET "movimientoId" = NULL;
-- pero entonces las órdenes recibidas quedan diciendo que sumaron un stock que
-- ya no existe. Por eso acá se borran.
DELETE FROM renglones_orden_compra;
DELETE FROM ordenes_compra;

-- La numeración vuelve a empezar: la próxima orden es OC-<año>-0001.
DELETE FROM contadores_documento;

-- ── 3. Movimientos de stock y su auditoría ──────────────────────────────────
-- ediciones_movimiento tiene ON DELETE CASCADE, así que se iría sola; se borra
-- explícito para que quede a la vista qué se está tirando.
DELETE FROM ediciones_movimiento;
DELETE FROM movimientos_stock;

-- ── 4. Stock en 0 ───────────────────────────────────────────────────────────
-- stockActual es un valor DERIVADO de los movimientos. Sin movimientos, el
-- único valor coherente es 0: si quedara en otro, el sistema mostraría un stock
-- que ningún movimiento respalda.
--
-- stockMinimo NO se toca: es el umbral de alerta que cargaron a mano, no stock.
UPDATE materiales SET "stockActual" = 0, "actualizadoEn" = NOW()
WHERE "stockActual" <> 0;

-- ── 5. Cómo quedó ───────────────────────────────────────────────────────────
SELECT 'DESPUES' AS momento,
       (SELECT COUNT(*) FROM materiales)              AS materiales,
       (SELECT COUNT(*) FROM proveedores)             AS proveedores,
       (SELECT COUNT(*) FROM equipos_it)              AS equipos_it,
       (SELECT COUNT(*) FROM asignaciones_equipo_it)  AS asignaciones,
       (SELECT COUNT(*) FROM usuarios)                AS usuarios,
       (SELECT COUNT(*) FROM movimientos_stock)       AS movimientos,
       (SELECT COUNT(*) FROM ordenes_compra)          AS ordenes,
       (SELECT COUNT(*) FROM materiales WHERE "stockActual" <> 0) AS con_stock;

-- Revisá la fila DESPUES: materiales 831, proveedores 1067, equipos_it 65,
-- movimientos 0, ordenes 0, con_stock 0.
--
-- Si los números cierran → COMMIT.  Si no → ROLLBACK.
COMMIT;
