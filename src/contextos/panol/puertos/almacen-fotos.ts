/**
 * Dónde viven las fotos de los materiales.
 *
 * Si no hay almacén configurado el sistema no se rompe: `estaConfigurado()`
 * devuelve false y la pantalla oculta la carga de la foto, igual que en los
 * equipos.
 */
export interface AlmacenFotosMateriales {
  estaConfigurado(): boolean;
  /** Guarda la imagen y devuelve su URL pública. */
  subir(contenido: Buffer, nombreOriginal: string, materialId: string): Promise<string>;
  /** Borra una imagen por su ruta. No falla si ya no está. */
  borrar(ruta: string): Promise<void>;
}

export const ALMACEN_FOTOS_MATERIALES = Symbol('AlmacenFotosMateriales');
