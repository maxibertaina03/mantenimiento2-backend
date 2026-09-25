import * as comun from '../../../common/dominio/errores';

/**
 * Errores del dominio de informática.
 *
 * El dominio no sabe que existe HTTP: no puede lanzar un BadRequestException
 * porque eso lo ataría a Nest y haría imposible probar estas reglas sin
 * levantar el framework. Lanza estos, y el filtro los traduce en el borde.
 *
 * Extienden las categorías de `common/dominio/errores`, que es solo el
 * contrato técnico —esto es un error de negocio, y de qué clase—. Estas clases
 * siguen siendo de este contexto: se pueden agregar o renombrar sin que nadie
 * más se entere.
 */
export const ErrorDominio = comun.ErrorDominio;
export type ErrorDominio = comun.ErrorDominio;

/** Lo que llegó no arma una credencial válida. */
export class ErrorDatosInvalidos extends comun.ErrorDatosInvalidos {}

/** Se pidió algo que no existe. */
export class ErrorNoEncontrado extends comun.ErrorNoEncontrado {}

/**
 * Choca con algo que ya existe: otra credencial con el mismo nombre.
 *
 * Extiende "datos invalidos" (400) y no "conflicto" (409) a proposito. Por
 * significado sería un 409, y al mover este modulo a un contexto el codigo
 * cambió solo de 400 a 409; lo agarró el test HTTP. Un refactor no cambia lo
 * que ve el frontend: si el codigo tiene que ser 409, es otra tarea, decidida
 * y avisada, no un efecto de haber movido archivos.
 */
export class ErrorNombreRepetido extends comun.ErrorDatosInvalidos {}

/**
 * No se sabe quién está pidiendo la contraseña.
 *
 * Es un error aparte porque no es un problema de lo que se mandó: el pedido
 * está bien formado y la credencial existe. Lo que falta es poder anotar quién
 * la vio, y sin eso el baúl entrega el secreto sin dejar rastro.
 */
export class ErrorSinIdentificar extends comun.ErrorNoAutorizado {}
