import * as comun from '../../../common/dominio/errores';

/**
 * Errores del dominio de compras.
 *
 * El dominio no sabe que existe HTTP. Lanza estos, y el borde los traduce a
 * las mismas excepciones que se lanzaban antes de mover el módulo: por eso
 * "la orden está EMITIDA y no puede pasar a RECIBIDA" sigue siendo un 400 y no
 * el 409 que le correspondería por significado. Un refactor no cambia lo que
 * ve el frontend.
 *
 * Los rechazos de un renglón (`ErrorRenglonInvalido`) no están acá: viven en
 * `common/dominio/renglon-de-compra` y ya salían por el filtro de dominio.
 */
export const ErrorDominio = comun.ErrorDominio;
export type ErrorDominio = comun.ErrorDominio;

/** Lo que llegó no arma una orden válida. → 400 */
export class ErrorDatosInvalidos extends comun.ErrorDatosInvalidos {}

/** Se pidió algo que no existe. → 404 */
export class ErrorNoEncontrado extends comun.ErrorNoEncontrado {}

/** La orden no puede hacer eso en el estado en que está. → 400 */
export class ErrorEstadoDeLaOrden extends comun.ErrorDatosInvalidos {}

/** Sin remito ni factura no se cierra una orden. → 400 */
export class ErrorSinComprobante extends comun.ErrorDatosInvalidos {}

/** No hay a quién mandarle la orden. → 400 */
export class ErrorSinDestinatario extends comun.ErrorDatosInvalidos {}

/** El envío automático de correo no está configurado. → 503 */
export class ErrorCorreoNoConfigurado extends comun.ErrorDominio {}

/** El servidor de correo rechazó el envío. → 502 */
export class ErrorEnvioFallido extends comun.ErrorDominio {}

/** Las clases de este contexto: solo estas se traducen en el borde. */
export const ERRORES_DE_COMPRAS = [
  ErrorDatosInvalidos,
  ErrorNoEncontrado,
  ErrorEstadoDeLaOrden,
  ErrorSinComprobante,
  ErrorSinDestinatario,
  ErrorCorreoNoConfigurado,
  ErrorEnvioFallido,
] as const;
