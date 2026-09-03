import { BadRequestException } from '@nestjs/common';

/**
 * Fecha en formato legible, sin la hora.
 *
 * El mensaje lo lee quien está cargando el movimiento, no un programador: un
 * ISO 8601 con milisegundos y zona horaria no le dice nada.
 */
function comoFecha(fecha: Date): string {
  return fecha.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Cordoba' });
}

/**
 * No se puede cargar un movimiento por detrás del último AJUSTE del material.
 *
 * El AJUSTE es la única operación que **no es conmutativa**: fija el stock en un
 * valor absoluto y descarta todo lo anterior. Dos entradas y una salida se
 * pueden intercalar en cualquier orden y el total es el mismo; una salida
 * metida antes de un ajuste, en cambio, deja de contar.
 *
 * Sin esta regla el sistema queda con dos respuestas distintas para el mismo
 * stock. El alta hace aritmética sobre el stock actual (resta la salida y
 * guarda 90), mientras que la edición recalcula el historial ordenado por fecha
 * (donde esa salida queda antes del ajuste y no cuenta, dando 100). Las dos
 * conviven en silencio hasta que alguien edita cualquier movimiento de ese
 * material, aunque sea para corregir una nota, y ahí el stock salta solo.
 *
 * Se prefiere prohibirlo antes que hacer que el alta también recalcule: así el
 * problema se ve en el momento de cargar, con una explicación, en vez de
 * convertirse en un movimiento registrado que no mueve el stock y que nadie
 * entiende.
 */
export function verificarNoQuedaDetrasDeUnAjuste(
  fechaDelMovimiento: Date,
  fechaDelUltimoAjuste: Date | null,
  nombreDelMaterial?: string,
): void {
  if (!fechaDelUltimoAjuste) return;
  if (fechaDelMovimiento.getTime() >= fechaDelUltimoAjuste.getTime()) return;

  const material = nombreDelMaterial ? ` de "${nombreDelMaterial}"` : '';
  throw new BadRequestException(
    `La fecha ${comoFecha(fechaDelMovimiento)} es anterior al último ajuste de stock` +
      `${material}, que es del ${comoFecha(fechaDelUltimoAjuste)}. ` +
      'Un ajuste fija el stock en un valor y borra lo anterior, así que un movimiento ' +
      'con fecha previa quedaría registrado pero no movería el stock. ' +
      'Cargalo con fecha posterior al ajuste, o corregí el stock con un ajuste nuevo.',
  );
}
