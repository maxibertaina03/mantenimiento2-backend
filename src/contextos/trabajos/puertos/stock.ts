/**
 * Lo único que el contexto de trabajos necesita del pañol.
 *
 * Deliberadamente chico. La tentación sería que la orden de trabajo hable
 * directo con el módulo de movimientos y use sus DTOs, y ahí se acabó la
 * separación: cualquier cambio en el formulario de movimientos rompería las
 * órdenes de trabajo. Con este puerto, el contexto pide "descontá esto" y no
 * sabe ni que existe una tabla de movimientos.
 *
 * Que la implementación de verdad genere un movimiento real, y no un número
 * anotado al costado, es lo que hace que el pañol y la orden no puedan
 * discrepar: son el mismo hecho registrado una sola vez.
 */
export interface DatosUsoDeMaterial {
  materialId: string;
  cantidad: number;
  /** Va en la referencia del movimiento, para que se lea en el historial. */
  numeroOrden: string;
  usuarioId: string | null;
  notas: string | null;
}

export interface Stock {
  /**
   * Saca del pañol lo que se usó y devuelve el id del movimiento que lo asentó.
   *
   * Puede fallar: no alcanza el stock, el material está jubilado, hay un ajuste
   * posterior. Esos errores vienen del pañol y suben tal cual, porque son los
   * mismos que vería quien cargara la salida a mano.
   */
  descontarPorTrabajo(datos: DatosUsoDeMaterial): Promise<{ movimientoId: string }>;

  /**
   * Devuelve al pañol un material que se había cargado por error.
   *
   * No borra la salida original: la compensa con una entrada. El stock queda
   * igual que antes y en el historial del material quedan los dos asientos, que
   * es lo que permite reconstruir qué pasó. Borrar el movimiento daría el mismo
   * número final y perdería la historia.
   */
  devolverPorTrabajo(datos: DatosUsoDeMaterial): Promise<{ movimientoId: string }>;
}

export const STOCK = Symbol('Stock');
