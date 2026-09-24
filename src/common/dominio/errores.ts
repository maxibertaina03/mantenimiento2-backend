/**
 * Las categorías de error que puede tener cualquier dominio.
 *
 * El dominio no sabe que existe HTTP: no puede lanzar un `BadRequestException`
 * porque eso lo ataría a Nest y haría imposible probar esas reglas sin
 * levantar el framework. Lanza estos, y un filtro los traduce a códigos de
 * estado en el borde.
 *
 * ## Por qué esto se comparte y los errores de cada contexto no
 *
 * En `contextos/trabajos/dominio/errores.ts` está escrito, con razón, que sus
 * errores son propios y no importados de equipos: **dos contextos que
 * comparten sus errores dejan de poder cambiar por separado**, que es
 * justamente lo que se gana al separarlos.
 *
 * Eso sigue valiendo y no cambia. Lo que se comparte acá no son los errores de
 * ningún negocio: es el *contrato técnico* de que algo es un error de negocio
 * y no una falla de infraestructura, más las cinco categorías que existen en
 * cualquier dominio porque se corresponden con las respuestas que sabe dar la
 * web.
 *
 * Cada contexto sigue teniendo su `dominio/errores.ts`, con sus clases, sus
 * nombres y sus comentarios; solo que extienden de acá. Un contexto puede
 * agregar, sacar o renombrar los suyos sin que ningún otro se entere.
 *
 * Lo que se gana: un solo filtro para todos, y un contexto nuevo —pañol,
 * compras, informática— lo hereda sin escribir nada.
 */
export abstract class ErrorDominio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    // El nombre de la subclase concreta, no "ErrorDominio". Es lo que después
    // viaja en el campo `error` de la respuesta, y lo que permite que el
    // frontend distinga un caso del otro sin mirar el texto.
    this.name = new.target.name;
  }
}

/** Lo que llegó no arma algo válido. → 400 */
export abstract class ErrorDatosInvalidos extends ErrorDominio {}

/** Se pidió algo que no existe. → 404 */
export abstract class ErrorNoEncontrado extends ErrorDominio {}

/**
 * La operación no es posible en el estado actual. → 409
 *
 * 409 y no 400: el pedido está bien formado. Lo que no da es el estado en el
 * que está la cosa, y la pantalla normalmente puede ofrecer una salida
 * ("reabrila primero").
 */
export abstract class ErrorTransicionInvalida extends ErrorDominio {}

/** Choca con algo que ya existe: un código repetido, por ejemplo. → 409 */
export abstract class ErrorConflicto extends ErrorDominio {}

/**
 * Está bien identificado, pero esto no le corresponde. → 403
 *
 * 403 y no 401: no es que no sepamos quién es. Sabemos quién es, y no es suyo.
 */
export abstract class ErrorNoAutorizado extends ErrorDominio {}
