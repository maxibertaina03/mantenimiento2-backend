import * as comun from '../../../common/dominio/errores';

/**
 * Errores del dominio de trabajos.
 *
 * El dominio no sabe que existe HTTP: no puede lanzar un BadRequestException
 * porque eso lo ataría a Nest y haría imposible testearlo sin levantar el
 * framework. Lanza estos, y la capa de infraestructura los traduce a códigos
 * de estado.
 *
 * Son propios y no importados del contexto de equipos a propósito: dos
 * contextos que comparten sus errores dejan de poder cambiar por separado, que
 * es justamente lo que se gana al separarlos.
 *
 * Lo que sí se comparte es la categoría de la que heredan
 * (`common/dominio/errores`), que no es un error de ningún negocio sino el
 * contrato técnico de que esto es una regla incumplida y no una falla de
 * infraestructura. Eso es lo que deja que haya un solo filtro para todos.
 */
export const ErrorDominio = comun.ErrorDominio;
export type ErrorDominio = comun.ErrorDominio;

/** Los datos que llegaron no arman una orden de trabajo válida. */
export class ErrorDatosInvalidos extends comun.ErrorDatosInvalidos {}

/** La operación pedida no es posible en el estado actual de la orden. */
export class ErrorTransicionInvalida extends comun.ErrorTransicionInvalida {}

/** Se pidió algo que no existe. */
export class ErrorNoEncontrado extends comun.ErrorNoEncontrado {}

/**
 * La orden está asignada a otra persona.
 *
 * Es un error aparte y no un "datos inválidos" porque no es un problema de lo
 * que se mandó: está bien formado y la orden existe. Lo que falta es ser quien
 * tiene que hacer ese trabajo, y eso merece un 403 y un mensaje que diga de
 * quién es.
 */
export class ErrorNoEsSuyo extends comun.ErrorNoAutorizado {}
