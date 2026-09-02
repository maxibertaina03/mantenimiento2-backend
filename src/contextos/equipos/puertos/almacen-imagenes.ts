export interface ImagenSubida {
  /** La URL para mostrarla con un `<img>`. */
  url: string;
  /** La ruta dentro del almacén, para poder borrarla después. */
  ruta: string;
}

/**
 * Dónde viven las fotos de los equipos.
 *
 * Es un puerto y no una llamada directa a Supabase por una razón concreta: el
 * plan gratuito da 1 GB y las fotos de la planta pesan 192 MB sin comprimir.
 * Si en algún momento no alcanza, mover todo a otro servicio es reemplazar el
 * adaptador; el dominio, los casos de uso y las pantallas ni se enteran.
 *
 * Si no hay almacén configurado el sistema no se rompe: `estaConfigurado()`
 * devuelve false y la pantalla oculta la carga de fotos, igual que hace el
 * correo cuando no hay clave.
 */
export interface AlmacenImagenes {
  estaConfigurado(): boolean;
  /**
   * Guarda la imagen y devuelve su URL.
   *
   * @param contenido los bytes de la imagen, ya comprimida por el navegador
   * @param nombreOriginal para conservar la extensión y algo reconocible
   * @param carpeta agrupa las imágenes; se usa el id del equipo
   */
  subir(contenido: Buffer, nombreOriginal: string, carpeta: string): Promise<ImagenSubida>;
  /** Borra una imagen. No falla si ya no está. */
  borrar(ruta: string): Promise<void>;
}

export const ALMACEN_IMAGENES = Symbol('AlmacenImagenes');
