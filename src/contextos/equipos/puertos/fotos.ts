/**
 * El puerto de las otras fotos de un equipo. El archivo va al almacén de
 * imágenes (`AlmacenImagenes`), el mismo de la foto principal.
 */

export interface Foto {
  id: string;
  equipoId: string;
  url: string;
  ruta: string;
  descripcion: string | null;
  subidoEn: Date;
  subidoPorNombre: string | null;
}

export interface RepositorioFotos {
  listar(equipoId: string): Promise<Foto[]>;
  buscar(equipoId: string, fotoId: string): Promise<Foto | null>;
  contar(equipoId: string): Promise<number>;
  crear(datos: {
    equipoId: string;
    url: string;
    ruta: string;
    descripcion: string | null;
    subidoPorId: string | null;
  }): Promise<Foto>;
  cambiarDescripcion(fotoId: string, descripcion: string | null): Promise<Foto>;
  eliminar(fotoId: string): Promise<void>;
  /**
   * Esta foto pasa a ser la principal del equipo, y la principal que había
   * (si había) queda en su lugar entre las otras. Las dos cosas juntas: si
   * una sola pasara, una de las dos fotos quedaría sin que nadie la vea.
   */
  intercambiarConPrincipal(foto: Foto, principalAnterior: string | null): Promise<void>;
}

export const REPOSITORIO_FOTOS = Symbol('RepositorioFotos');
