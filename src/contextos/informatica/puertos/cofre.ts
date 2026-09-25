/**
 * Lo único que este contexto sabe de criptografía.
 *
 * El dominio decide *cuándo* una contraseña se puede usar; cómo se cifra, con
 * qué algoritmo y de dónde sale la clave es otra cosa, y vive detrás de este
 * puerto. Así las reglas se prueban sin cifrar nada, y cambiar el algoritmo no
 * toca ninguna regla.
 *
 * `huella` existe para poder responder "¿esta contraseña ya se usó?" sin
 * guardar las viejas. Si el historial guardara los valores, una filtración se
 * llevaría todas las claves que pasaron por acá y no solo la vigente.
 */
export interface Cofre {
  cifrar(texto: string): string;
  descifrar(cifrado: string): string;
  /** Una marca que identifica la contraseña sin permitir recuperarla. */
  huella(texto: string): string;
  /** Si el texto corresponde a esa huella. */
  coincideConLaHuella(texto: string, huella: string): boolean;
}

export const COFRE = Symbol('Cofre');
