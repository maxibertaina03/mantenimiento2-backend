/**
 * Cuándo le toca rotar a una credencial.
 *
 * Va aparte, sin Nest y sin Prisma, porque es la regla que decide si el sistema
 * avisa o no avisa. Recibe el día de hoy en vez de mirarlo del reloj: es lo que
 * permite probar "faltan tres días" sin esperar tres días.
 */

/** Cuántos días antes del vencimiento se considera que ya hay que avisar. */
export const DIAS_DE_AVISO = 7;

export type EstadoRotacion = 'sin-rotacion' | 'al-dia' | 'por-vencer' | 'vencida';

/**
 * La fecha en que hay que volver a cambiar la contraseña.
 *
 * Devuelve null si la credencial no tiene rotación configurada, que es el caso
 * normal: no todo acceso necesita cambiarse cada tanto, y poner una fecha a
 * todo convierte los avisos en ruido que nadie mira.
 */
export function calcularProximaRotacion(
  rotadaEn: Date,
  rotarCadaDias: number | null | undefined,
): Date | null {
  if (!rotarCadaDias || rotarCadaDias <= 0) return null;

  const proxima = new Date(rotadaEn);
  proxima.setUTCDate(proxima.getUTCDate() + rotarCadaDias);
  return proxima;
}

/** Cuántos días faltan (negativo si ya pasó). */
export function diasHasta(proximaRotacion: Date, hoy: Date): number {
  const unDia = 24 * 60 * 60 * 1000;
  const desde = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  const hasta = Date.UTC(
    proximaRotacion.getUTCFullYear(),
    proximaRotacion.getUTCMonth(),
    proximaRotacion.getUTCDate(),
  );
  return Math.round((hasta - desde) / unDia);
}

/**
 * En qué estado está la credencial hoy.
 *
 * El día exacto del vencimiento cuenta como `por-vencer` y no como `vencida`:
 * quien lo mira ese día todavía está a tiempo, y decirle que ya venció lo manda
 * a apagar un incendio que no empezó.
 */
export function estadoDeRotacion(
  proximaRotacion: Date | null | undefined,
  hoy: Date,
): EstadoRotacion {
  if (!proximaRotacion) return 'sin-rotacion';

  const faltan = diasHasta(proximaRotacion, hoy);
  if (faltan < 0) return 'vencida';
  if (faltan <= DIAS_DE_AVISO) return 'por-vencer';
  return 'al-dia';
}
