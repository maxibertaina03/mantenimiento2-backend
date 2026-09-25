import * as comun from './errores';

/**
 * Lo que se pidió comprar no se entiende.
 *
 * Las categorías de `errores.ts` son abstractas a propósito: cada contexto
 * define las suyas, para poder cambiarlas sin arrastrar a los demás. Esta es
 * la de los renglones de compra.
 */
export class ErrorRenglonInvalido extends comun.ErrorDatosInvalidos {}

/**
 * Qué se está comprando en un renglón de una orden.
 *
 * Un renglón es de un MATERIAL del pañol —que lleva stock— o de un EQUIPO
 * —que lleva ficha propia—, nunca de los dos. Son dos caminos distintos al
 * recibir la mercadería: el material suma stock, el equipo da de alta una
 * ficha por unidad comprada.
 */
export type ClaseDeRenglon = 'material' | 'equipo';

/** Una máquina de planta, o una herramienta que merece ficha propia. */
export const CLASIFICACIONES_EQUIPO = ['EQUIPO', 'HERRAMIENTA'] as const;
export type ClasificacionEquipo = (typeof CLASIFICACIONES_EQUIPO)[number];

export interface RenglonComprado {
  materialId?: string | null;
  descripcionEquipo?: string | null;
  clasificacion?: ClasificacionEquipo | null;
  cantidad: number;
}

/**
 * Decide qué clase de renglón es, y de paso comprueba que sea uno solo.
 *
 * Es la misma forma que ya tienen las órdenes de trabajo con las máquinas de
 * planta y las de informática: dos campos excluyentes y una función que lo
 * hace cumplir, en vez de un campo "tipo" que hay que consultar antes de saber
 * a qué tabla ir.
 */
export function claseDelRenglon(renglon: RenglonComprado): ClaseDeRenglon {
  const tieneMaterial = Boolean(renglon.materialId);
  const tieneEquipo = Boolean(renglon.descripcionEquipo);

  if (tieneMaterial && tieneEquipo) {
    throw new ErrorRenglonInvalido(
      'Un renglón es de un material del pañol o de un equipo, no de los dos. ' +
        'Si es un equipo, dejá el material vacío.',
    );
  }

  if (!tieneMaterial && !tieneEquipo) {
    throw new ErrorRenglonInvalido(
      'Cada renglón tiene que decir qué se compra: un material del pañol, o un equipo ' +
        'con su descripción.',
    );
  }

  return tieneMaterial ? 'material' : 'equipo';
}

/**
 * Cuántas fichas de equipo hay que dar de alta al recibir este renglón.
 *
 * Una por unidad: cinco amoladoras son cinco fichas, cada una con su número de
 * serie y su historial. Por eso la cantidad de un equipo tiene que ser un
 * número entero — media amoladora no existe.
 */
export function unidadesDeEquipo(renglon: RenglonComprado): number {
  if (claseDelRenglon(renglon) !== 'equipo') return 0;

  if (!Number.isInteger(renglon.cantidad) || renglon.cantidad < 1) {
    throw new ErrorRenglonInvalido(
      `Un equipo se compra por unidades enteras, y vino ${renglon.cantidad}. ` +
        'Cada unidad va a quedar como una ficha aparte.',
    );
  }

  return renglon.cantidad;
}
