import { ErrorConflicto, ErrorDatosInvalidos, ErrorTransicionInvalida } from './errores';
import { EstadoEquipo } from './estado-equipo';

/**
 * Las reglas de la lista de repuestos de un equipo: qué materiales del pañol
 * lleva la máquina.
 *
 * Un equipo lleva muchos materiales y un material va en muchos equipos (el
 * mismo retén sirve para tres bombas). La lista no mueve stock: dice qué lleva
 * la máquina, no qué se usó.
 */

/** Lo que hace falta saber del equipo y del material para decidir. */
export interface EquipoParaRepuesto {
  nombre: string;
  estado: EstadoEquipo;
}

export interface MaterialParaRepuesto {
  nombre: string;
  activo: boolean;
}

/** Largo máximo de la nota de un repuesto. */
export const MAX_NOTAS_REPUESTO = 200;

/**
 * Comprueba que el material se pueda sumar a la lista del equipo.
 *
 * - A un equipo dado de baja no se le cargan repuestos: ya no se arregla.
 * - Un material fuera de circulación tampoco: es justamente el que ya no se
 *   compra, y la lista tiene que decir qué ir a buscar.
 * - Un material va una sola vez por equipo. Cuántos lleva lo dice la cantidad;
 *   dos renglones del mismo retén solo confunden.
 */
export function validarRepuestoNuevo(
  equipo: EquipoParaRepuesto,
  material: MaterialParaRepuesto,
  yaEstaEnLaLista: boolean,
): void {
  if (equipo.estado === 'DADO_DE_BAJA') {
    throw new ErrorTransicionInvalida(
      `«${equipo.nombre}» está dado de baja: no se le cargan repuestos.`,
    );
  }
  if (!material.activo) {
    throw new ErrorDatosInvalidos(
      `«${material.nombre}» está fuera de circulación en el pañol: no se puede sumar como repuesto.`,
    );
  }
  if (yaEstaEnLaLista) {
    throw new ErrorConflicto(
      `«${material.nombre}» ya está en los repuestos de «${equipo.nombre}». Si lleva más de uno, cambiá la cantidad.`,
    );
  }
}

/** Limpia la cantidad y la nota: vacío es null, y la cantidad tiene que ser positiva. */
export function datosDelRepuesto(datos: { cantidad?: number | null; notas?: string | null }): {
  cantidad: number | null | undefined;
  notas: string | null | undefined;
} {
  const { cantidad, notas } = datos;
  if (cantidad !== undefined && cantidad !== null && !(cantidad > 0)) {
    throw new ErrorDatosInvalidos('La cantidad tiene que ser mayor que cero, o quedar vacía.');
  }
  const nota = notas === undefined ? undefined : notas?.trim() || null;
  if (nota && nota.length > MAX_NOTAS_REPUESTO) {
    throw new ErrorDatosInvalidos(`La nota no puede pasar de ${MAX_NOTAS_REPUESTO} caracteres.`);
  }
  return { cantidad, notas: nota };
}
