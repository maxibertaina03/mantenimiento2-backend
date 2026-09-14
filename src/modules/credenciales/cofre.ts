import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * El cofre: cifra y descifra los secretos del baúl de credenciales.
 *
 * Es una pieza pura, sin Nest y sin Prisma, porque es la única del sistema
 * donde un error es silencioso: si el cifrado estuviera mal, nada falla, nada
 * avisa, y las contraseñas quedan guardadas de una forma que no protege nada.
 * Aislada así se puede probar de verdad.
 *
 * La clave vive en una variable de entorno, NO en la base. Esa es toda la
 * protección que hay: un volcado de la base, como el backup que se guarda en
 * el disco, no alcanza para leer ninguna contraseña. La contracara es que la
 * clave no se puede perder, porque no hay forma de recuperar lo cifrado.
 */

/** AES-256-GCM: cifra y además detecta si el texto guardado fue alterado. */
const ALGORITMO = 'aes-256-gcm';

/** 32 bytes, que es lo que pide AES-256. */
export const LARGO_DE_CLAVE = 32;

/**
 * Marca de versión al principio de lo guardado.
 *
 * Si algún día hay que cambiar de algoritmo, lo viejo se sigue pudiendo leer
 * porque dice cómo fue escrito. Sin esto, cambiar de algoritmo obliga a
 * descifrar y volver a cifrar todo en una sola migración, que es exactamente
 * el momento en que las contraseñas quedan en claro en algún lado.
 */
const VERSION = 'v1';

export class ErrorDeCofre extends Error {}

/**
 * Interpreta la clave que viene del entorno.
 *
 * Se acepta en base64 o en hexadecimal, y tiene que dar exactamente 32 bytes.
 * Una clave corta no da error de AES: Node la rechaza, pero el mensaje no
 * explica nada, así que se valida acá con un texto que se entienda.
 */
export function leerClave(valor: string): Buffer {
  const limpio = valor.trim();
  if (!limpio) {
    throw new ErrorDeCofre('La clave del cofre está vacía.');
  }

  const esHex = /^[0-9a-fA-F]+$/.test(limpio) && limpio.length === LARGO_DE_CLAVE * 2;
  const clave = Buffer.from(limpio, esHex ? 'hex' : 'base64');

  if (clave.length !== LARGO_DE_CLAVE) {
    throw new ErrorDeCofre(
      `La clave del cofre tiene que ser de ${LARGO_DE_CLAVE} bytes y tiene ${clave.length}. ` +
        "Generá una con: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  return clave;
}

/** Una clave nueva, lista para pegar en la variable de entorno. */
export function generarClave(): string {
  return randomBytes(LARGO_DE_CLAVE).toString('base64');
}

export class Cofre {
  constructor(private readonly clave: Buffer) {
    if (clave.length !== LARGO_DE_CLAVE) {
      throw new ErrorDeCofre(`La clave tiene que ser de ${LARGO_DE_CLAVE} bytes.`);
    }
  }

  /**
   * Cifra un secreto. Devuelve una sola cadena lista para guardar.
   *
   * El vector de inicialización es distinto en cada llamada, así que cifrar dos
   * veces la MISMA contraseña da dos textos distintos. Es a propósito: si
   * fueran iguales, mirando la base se sabría qué credenciales comparten clave
   * sin necesidad de descifrar ninguna.
   */
  cifrar(secreto: string): string {
    if (secreto === '') throw new ErrorDeCofre('No se puede guardar un secreto vacío.');

    const iv = randomBytes(12);
    const cifrador = createCipheriv(ALGORITMO, this.clave, iv);
    const cuerpo = Buffer.concat([cifrador.update(secreto, 'utf8'), cifrador.final()]);
    const etiqueta = cifrador.getAuthTag();

    return [
      VERSION,
      iv.toString('base64'),
      etiqueta.toString('base64'),
      cuerpo.toString('base64'),
    ].join(':');
  }

  /**
   * Descifra lo guardado.
   *
   * Si el texto fue alterado en la base, o si la clave no es la que lo cifró,
   * GCM lo detecta y esto falla. Falla a propósito: devolver algo parecido a un
   * secreto sería peor que no devolver nada.
   */
  descifrar(guardado: string): string {
    const partes = guardado.split(':');
    if (partes.length !== 4 || partes[0] !== VERSION) {
      throw new ErrorDeCofre('El secreto guardado no tiene el formato esperado.');
    }
    const [, iv, etiqueta, cuerpo] = partes;

    try {
      const descifrador = createDecipheriv(ALGORITMO, this.clave, Buffer.from(iv, 'base64'));
      descifrador.setAuthTag(Buffer.from(etiqueta, 'base64'));
      return Buffer.concat([
        descifrador.update(Buffer.from(cuerpo, 'base64')),
        descifrador.final(),
      ]).toString('utf8');
    } catch {
      throw new ErrorDeCofre(
        'No se pudo descifrar el secreto. O la clave del cofre cambió, o el dato fue alterado.',
      );
    }
  }

  /**
   * La huella de un secreto: sirve para saber si una contraseña nueva es una
   * que ya se usó, sin guardar la vieja en ningún lado.
   *
   * Es un HMAC con la misma clave del cofre y no un hash a secas. Sin la clave,
   * quien tenga la base no puede probar contraseñas comunes contra las huellas
   * para ver cuál coincide.
   */
  huella(secreto: string): string {
    return createHmac('sha256', this.clave).update(secreto, 'utf8').digest('base64');
  }

  /** Si un secreto es el que dejó esa huella. */
  coincideConLaHuella(secreto: string, huella: string): boolean {
    const calculada = Buffer.from(this.huella(secreto), 'base64');
    const guardada = Buffer.from(huella, 'base64');
    // Comparación de tiempo constante: comparar con === filtra, por el tiempo
    // que tarda, cuántos bytes coincidían.
    if (calculada.length !== guardada.length) return false;
    return timingSafeEqual(calculada, guardada);
  }
}
