import { buscarNombreRepetido } from '../../../common/dominio/nombres';
import {
  ErrorDatosInvalidos,
  ErrorMaterialConHistorial,
  ErrorMaterialDesactivado,
  ErrorNombreRepetido,
} from './errores';

/**
 * Las reglas de la ficha de un material.
 *
 * El stock no se toca desde acá: solo cambia por movimientos. Esto cuida lo
 * demás —que no haya dos fichas para lo mismo, que la ubicación signifique
 * algo, que borrar no se lleve el historial—.
 */

/**
 * Rechaza un nombre que ya existe, salvo que sea el del propio material.
 *
 * Sin esto, "Rodamiento 6204" y "RODAMIENTO 6204" conviven como materiales
 * distintos y el stock se parte en dos fichas sin que nadie lo note. La carga
 * rápida desde la orden de compra lo hace especialmente fácil: ahí se escribe
 * de memoria, sin mirar el catálogo.
 *
 * Recibe el padrón entero y no solo los que coinciden sin mayúsculas, porque
 * Postgres tampoco compara sin acentos.
 */
export function validarNombreLibre(
  existentes: { id: string; nombre: string }[],
  nombre: string,
  exceptoId?: string,
): void {
  const choque = buscarNombreRepetido(existentes, nombre, exceptoId);
  if (choque) {
    throw new ErrorNombreRepetido(
      `Ya existe un material llamado "${choque.nombre}". Usá ese en vez de crear otro: ` +
        'dos fichas para lo mismo parten el stock en dos y ninguna queda bien.',
    );
  }
}

/**
 * Una fila sin estantería no significa nada.
 *
 * "Fila 3" a secas no ubica a nadie, y guardarlo deja un dato que parece
 * información y no lo es. Es una regla entre dos campos, no la forma de uno.
 */
export function validarUbicacion(estanteriaId?: string | null, fila?: number | null): void {
  if (fila !== undefined && fila !== null && !estanteriaId) {
    throw new ErrorDatosInvalidos(
      'Para guardar la fila hace falta elegir también la estantería: una fila sola no ubica el material.',
    );
  }
}

/**
 * La ubicación que va a quedar guardada después de un cambio.
 *
 * La regla se valida contra esto, no solo contra lo que vino: mandar la fila
 * sola sobre un material sin estantería deja una fila huérfana.
 *
 * Vaciar la estantería NO es ese caso: ahí la fila se vacía con ella.
 */
export function ubicacionFinal(
  actual: { estanteriaId: string | null; fila: number | null } | null,
  cambios: { estanteriaId?: string | null; fila?: number | null },
): { estanteriaId: string | null; fila: number | null } {
  const estanteriaId =
    cambios.estanteriaId !== undefined ? cambios.estanteriaId : (actual?.estanteriaId ?? null);
  const fila = estanteriaId
    ? cambios.fila !== undefined
      ? cambios.fila
      : (actual?.fila ?? null)
    : // Sin estantería no queda fila: o la mandaron suelta (y se rechaza), o
      // se está vaciando la ubicación entera (y es válido).
      (cambios.fila ?? null);
  return { estanteriaId, fila };
}

/**
 * Un material jubilado no se usa en cargas nuevas: un movimiento, una orden de
 * compra. Editar un movimiento viejo sigue permitido, porque eso es corregir
 * historia, no seguir usándolo.
 */
export function validarEnUso(material: { nombre: string; activo: boolean }): void {
  if (!material.activo) {
    throw new ErrorMaterialDesactivado(
      `El material "${material.nombre}" está desactivado y no se puede usar en cargas ` +
        'nuevas. Si volvió a hacer falta, activalo de nuevo desde su ficha.',
    );
  }
}

/**
 * Lo mismo, con las palabras de un movimiento: es lo que se lee al cargar uno.
 */
export function validarAdmiteMovimientos(material: { nombre: string; activo: boolean }): void {
  if (!material.activo) {
    throw new ErrorMaterialDesactivado(
      `El material "${material.nombre}" está desactivado y no admite movimientos nuevos. ` +
        'Si volvió a hacer falta, activalo de nuevo desde su ficha.',
    );
  }
}

/**
 * Con movimientos no se borra.
 *
 * Borrarlo se llevaría puesto el historial, que es lo que hay que conservar.
 * Desactivarlo hace lo que la persona quiere —sacarlo de las listas— sin
 * perder nada, así que el mensaje lo ofrece en vez de dejarla sin salida.
 */
export function validarEliminable(movimientos: number): void {
  if (movimientos > 0) {
    throw new ErrorMaterialConHistorial(
      `No se puede eliminar: el material tiene ${movimientos} movimiento(s) registrado(s), ` +
        'y borrarlo se llevaría ese historial. Si ya no se usa, desactivalo: deja de ' +
        'aparecer al cargar movimientos y órdenes, pero se conserva todo lo registrado.',
    );
  }
}
