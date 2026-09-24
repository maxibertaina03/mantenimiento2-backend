import * as comun from '../../../common/dominio/errores';

/**
 * Errores del dominio de equipos.
 *
 * El dominio no sabe que existe HTTP: no puede lanzar un BadRequestException
 * porque eso lo ataría a Nest y haría imposible testearlo sin levantar el
 * framework. Lanza estos, y la capa de infraestructura los traduce a códigos
 * de estado.
 *
 * Extienden las categorías de `common/dominio/errores`, que es solo el
 * contrato técnico —esto es un error de negocio, y de qué clase— y no los
 * errores de ningún otro contexto. Estas clases siguen siendo de equipos: se
 * pueden agregar, sacar o renombrar sin que nadie más se entere.
 */
export const ErrorDominio = comun.ErrorDominio;
export type ErrorDominio = comun.ErrorDominio;

/** Los datos que llegaron no arman un equipo válido. */
export class ErrorDatosInvalidos extends comun.ErrorDatosInvalidos {}

/** La operación pedida no es posible en el estado actual. */
export class ErrorTransicionInvalida extends comun.ErrorTransicionInvalida {}

/** Se pidió algo que no existe. */
export class ErrorNoEncontrado extends comun.ErrorNoEncontrado {}

/** Choca con algo que ya existe (un código repetido, por ejemplo). */
export class ErrorConflicto extends comun.ErrorConflicto {}
