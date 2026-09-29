/**
 * Lo que el pañol necesita saber de los catálogos: si existe lo que se eligió.
 *
 * Categorías y unidades siguen siendo módulos aparte, a propósito: son
 * catálogos, y envolverlos en cuatro capas sería ceremonia. Se los consulta por
 * este puerto angosto, sin depender de cómo están hechos.
 */
export const CONSULTA_CATALOGOS = Symbol('CONSULTA_CATALOGOS');

export interface ConsultaCatalogos {
  existeCategoria(id: string): Promise<boolean>;
  existeUnidad(id: string): Promise<boolean>;
}
