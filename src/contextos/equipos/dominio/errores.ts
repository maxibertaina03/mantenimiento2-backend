/**
 * Errores del dominio.
 *
 * El dominio no sabe que existe HTTP: no puede lanzar un BadRequestException
 * porque eso lo ataría a Nest y haría imposible testearlo sin levantar el
 * framework. Lanza estos, y la capa de infraestructura los traduce a códigos
 * de estado.
 */
export abstract class ErrorDominio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

/** Los datos que llegaron no arman un equipo válido. */
export class ErrorDatosInvalidos extends ErrorDominio {}

/** La operación pedida no es posible en el estado actual. */
export class ErrorTransicionInvalida extends ErrorDominio {}

/** Se pidió algo que no existe. */
export class ErrorNoEncontrado extends ErrorDominio {}

/** Choca con algo que ya existe (un código repetido, por ejemplo). */
export class ErrorConflicto extends ErrorDominio {}
