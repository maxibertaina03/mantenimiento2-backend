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
 */
export abstract class ErrorDominio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

/** Los datos que llegaron no arman una orden de trabajo válida. */
export class ErrorDatosInvalidos extends ErrorDominio {}

/** La operación pedida no es posible en el estado actual de la orden. */
export class ErrorTransicionInvalida extends ErrorDominio {}

/** Se pidió algo que no existe. */
export class ErrorNoEncontrado extends ErrorDominio {}
