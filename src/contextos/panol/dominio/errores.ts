import * as comun from '../../../common/dominio/errores';

/**
 * Errores del dominio del pañol.
 *
 * El dominio no sabe que existe HTTP. Lanza estos, y el borde los traduce.
 *
 * Todos los "no se puede" del pañol son 400, como eran antes de mover el
 * módulo, aunque algunos por significado serían 409. Un refactor no cambia lo
 * que ve el frontend: si alguno tiene que cambiar de código, es otra tarea,
 * decidida y avisada.
 */
export const ErrorDominio = comun.ErrorDominio;
export type ErrorDominio = comun.ErrorDominio;

/** Lo que llegó no arma un movimiento o un material válido. → 400 */
export class ErrorDatosInvalidos extends comun.ErrorDatosInvalidos {}

/** Se pidió algo que no existe. → 404 */
export class ErrorNoEncontrado extends comun.ErrorNoEncontrado {}

/** El movimiento es de otra persona. → 403 */
export class ErrorNoAutorizado extends comun.ErrorNoAutorizado {}

/** La salida se lleva más de lo que hay. → 400 */
export class ErrorStockInsuficiente extends comun.ErrorDatosInvalidos {}

/** El resultado dejaría el stock por debajo de cero. → 400 */
export class ErrorStockNegativo extends comun.ErrorDatosInvalidos {}

/** Un movimiento con fecha por detrás del último ajuste del material. → 400 */
export class ErrorFechaDetrasDeUnAjuste extends comun.ErrorDatosInvalidos {}

/** El material está desactivado y no admite cargas nuevas. → 400 */
export class ErrorMaterialDesactivado extends comun.ErrorDatosInvalidos {}

/** Ya hay otro material con ese nombre. → 400 */
export class ErrorNombreRepetido extends comun.ErrorDatosInvalidos {}

/** Borrarlo se llevaría su historial. → 400 */
export class ErrorMaterialConHistorial extends comun.ErrorDatosInvalidos {}
