/**
 * Cómo se compara un nombre con otro para saber si son la misma cosa.
 *
 * Vive acá y no adentro de un módulo porque la regla es la misma en todos los
 * catálogos del sistema: materiales, categorías, unidades, tipos, marcas,
 * modelos, estanterías y personas. Cada vez que estuvo escrita por separado,
 * quedó distinta en algún lado, y el agujero aparece siempre en el mismo lugar:
 * la base compara sin distinguir mayúsculas, pero los acentos sí los distingue.
 */

/**
 * Deja el nombre listo para guardar: sin espacios de sobra ni dobles.
 *
 * "  Rodamiento  6204 " y "Rodamiento 6204" son la misma cosa, y quien lo
 * escribe no ve la diferencia.
 */
export function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ');
}

/**
 * La forma con la que se comparan dos nombres para saber si son el mismo.
 *
 * Ignora mayúsculas, acentos y espacios repetidos. No se guarda: se usa solo
 * para comparar, porque el nombre tiene que quedar escrito como lo escribió la
 * persona.
 *
 * Sin esto, "Rodamiento 6204" y "RODAMIENTO 6204" conviven como dos materiales
 * distintos y el stock se parte en dos fichas sin que nadie lo note. La carga
 * rápida desde la orden de compra lo hace especialmente fácil: ahí se escribe
 * de memoria, sin mirar el catálogo.
 */
export function claveDeComparacion(nombre: string): string {
  return (
    normalizarNombre(nombre)
      .toLowerCase()
      .normalize('NFD')
      // Saca los acentos que la descomposición NFD dejó como caracteres sueltos.
      // El rango va escapado a propósito: escrito con los caracteres reales es
      // invisible en el editor y cualquiera lo rompe sin darse cuenta.
      .replace(/[\u0300-\u036f]/g, '')
  );
}

/** Si dos nombres son, a los fines prácticos, la misma cosa. */
export function sonElMismoNombre(a: string, b: string): boolean {
  return claveDeComparacion(a) === claveDeComparacion(b);
}

/**
 * El primero de la lista que ya se llama así, si hay alguno.
 *
 * La comparación se hace acá y no en la consulta a propósito. Postgres, sin la
 * extensión `unaccent`, no tiene forma de ignorar acentos: `mode: 'insensitive'`
 * resuelve las mayúsculas y nada más, así que "Válvulas" y "Valvulas" pasaban
 * los dos y el catálogo terminaba con las dos filas. Los catálogos tienen
 * decenas de filas: traerlas todas para comparar no cuesta nada.
 *
 * `exceptoId` es para editar: un item no choca consigo mismo.
 */
export function buscarNombreRepetido<T extends { id: string; nombre: string }>(
  existentes: readonly T[],
  nombre: string,
  exceptoId?: string,
): T | undefined {
  return existentes.find((e) => e.id !== exceptoId && sonElMismoNombre(e.nombre, nombre));
}
