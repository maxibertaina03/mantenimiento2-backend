/**
 * Deja el nombre listo para guardar: sin espacios de sobra ni dobles.
 *
 * "  Rodamiento  6204 " y "Rodamiento 6204" son el mismo material, y quien lo
 * escribe no ve la diferencia.
 */
export function normalizarNombreMaterial(nombre: string): string {
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
    normalizarNombreMaterial(nombre)
      .toLowerCase()
      .normalize('NFD')
      // Saca los acentos que la descomposición NFD dejó como caracteres sueltos.
      // El rango va escapado a propósito: escrito con los caracteres reales es
      // invisible en el editor y cualquiera lo rompe sin darse cuenta.
      .replace(/[\u0300-\u036f]/g, '')
  );
}

/** Si dos nombres son, a los fines prácticos, el mismo material. */
export function sonElMismoNombre(a: string, b: string): boolean {
  return claveDeComparacion(a) === claveDeComparacion(b);
}
