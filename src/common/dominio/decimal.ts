import { Prisma } from '@prisma/client';

/**
 * Tipo decimal de precisión arbitraria para cantidades y stock.
 *
 * Las cantidades se guardan como Decimal(14,3): hacer la aritmética con `number`
 * arrastra error de punto flotante (0.1 + 0.2 = 0.30000000000000004) y ese error
 * llega a comparaciones de negocio como "¿el stock quedó negativo?".
 *
 * Este archivo es el ÚNICO punto del dominio que toca `@prisma/client`: si algún
 * día se cambia el ORM, se reemplaza acá (Prisma.Decimal es decimal.js).
 */
export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

/** Cantidad de decimales de las columnas Decimal(14,3). */
export const ESCALA_CANTIDAD = 3;

/** Convierte cualquier entrada numérica a Decimal, redondeada a la escala de la DB. */
export function aDecimal(valor: Decimal | number | string): Decimal {
  return new Decimal(valor).toDecimalPlaces(ESCALA_CANTIDAD);
}

/** Serializa a `number` para las respuestas JSON de la API. */
export function aNumero(valor: Decimal | number | string): number {
  return new Decimal(valor).toDecimalPlaces(ESCALA_CANTIDAD).toNumber();
}
