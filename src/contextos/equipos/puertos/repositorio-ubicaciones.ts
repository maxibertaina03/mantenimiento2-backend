export interface Ubicacion {
  id: string;
  nombre: string;
}

/**
 * Acceso al catálogo de ubicaciones, para lo que necesita la importación.
 *
 * Está aparte del repositorio de equipos porque son dos cosas distintas, y
 * porque así el caso de uso de importar declara exactamente lo que toca: crea
 * ubicaciones y crea equipos, nada más.
 */
export interface RepositorioUbicaciones {
  /**
   * Busca sin distinguir mayúsculas.
   *
   * En las carpetas de la planta hay "PRETRATAMIENTO DE LECHE" en mayúsculas
   * junto a nombres en minúscula. Sin esto, la importación crearía una
   * ubicación nueva al lado de la que ya existe y los equipos quedarían
   * repartidos entre las dos.
   */
  buscarPorNombre(nombre: string): Promise<Ubicacion | null>;
  crear(nombre: string, orden: number): Promise<Ubicacion>;
}

export const REPOSITORIO_UBICACIONES = Symbol('RepositorioUbicaciones');
