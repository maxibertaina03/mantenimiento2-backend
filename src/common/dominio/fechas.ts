/**
 * Helpers de rango de fechas para filtros inclusivos.
 *
 * `new Date('2026-08-25')` se interpreta como 2026-08-25T00:00:00.000Z, así que
 * usarlo como cota superior (`lte`) deja AFUERA todos los movimientos cargados
 * ese mismo día. Estos helpers expanden la fecha al día completo.
 *
 * Si la cadena ya trae hora (ISO completo), se respeta tal cual: quien manda un
 * instante exacto quiere ese instante, no el día entero.
 */

/** true si la cadena es solo fecha (YYYY-MM-DD), sin componente horario. */
function esSoloFecha(valor: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor.trim());
}

/** Cota inferior inclusiva: 00:00:00.000 del día indicado. */
export function inicioDelDia(valor: string): Date {
  const fecha = new Date(valor);
  if (esSoloFecha(valor)) {
    fecha.setUTCHours(0, 0, 0, 0);
  }
  return fecha;
}

/** Cota superior inclusiva: 23:59:59.999 del día indicado. */
export function finDelDia(valor: string): Date {
  const fecha = new Date(valor);
  if (esSoloFecha(valor)) {
    fecha.setUTCHours(23, 59, 59, 999);
  }
  return fecha;
}
