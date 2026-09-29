/**
 * Clave para ordenar los equipos como los nombra la gente, no como los ordena
 * el alfabeto.
 *
 * Comparando texto, "PC10" va antes que "PC2" porque el carácter "1" es menor
 * que "2". Acá se separa el código en prefijo + número final y el número se
 * rellena con ceros, así "PC2" queda "PC0000000002" y "PC10" queda
 * "PC0000000010": el orden de texto ya coincide con el orden natural.
 *
 * De paso, los códigos con el mismo prefijo quedan juntos (todas las PC, después
 * todas las PCF, después las IMPRESORA), que es como se lee un inventario.
 *
 * Se guarda en una columna para poder ordenar y paginar en la base: ordenar en
 * memoria rompería la paginación (solo se vería ordenada la página actual).
 */

/** Ancho del número. 10 dígitos entran cómodos en cualquier inventario real. */
const DIGITOS = 10;

export function claveDeOrden(codigoInterno: string | null | undefined): string | null {
  const codigo = (codigoInterno ?? '').trim().replace(/\s+/g, ' ');
  if (!codigo) return null;

  // Los dígitos del final son el número; lo de antes, el prefijo.
  const numero = /(\d+)$/.exec(codigo)?.[1] ?? '';
  const prefijo = numero ? codigo.slice(0, codigo.length - numero.length) : codigo;

  // El prefijo se recorta: sin esto, "GRABADORA 1" (prefijo "GRABADORA ") y
  // "GRABADORA" (prefijo "GRABADORA") caían en grupos distintos por un espacio.
  // Mayúsculas para que "Mikrotik" y "MIKROTIK" queden juntos.
  return `${prefijo.trim().toUpperCase()}${(numero || '0').padStart(DIGITOS, '0')}`;
}
