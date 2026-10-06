import { ErrorDatosInvalidos, ErrorNoEncontrado } from '../dominio/errores';
import { limpiarDescripcion, validarFoto } from '../dominio/foto';
import { AlmacenImagenes } from '../puertos/almacen-imagenes';
import { Foto, RepositorioFotos } from '../puertos/fotos';
import { EquipoConRelaciones, RepositorioEquipos } from '../puertos/repositorio-equipos';

/**
 * Las otras fotos de un equipo: subirlas, describirlas, borrarlas y elegir
 * cuál es la principal.
 *
 * Un equipo tiene una foto principal, la de la lista, y además la chapa
 * característica con los datos, el tablero, lo que haga falta.
 */
export class GestionarFotos {
  constructor(
    private readonly fotos: RepositorioFotos,
    private readonly almacen: AlmacenImagenes,
    private readonly equipos: RepositorioEquipos,
  ) {}

  private async traerEquipo(equipoId: string): Promise<EquipoConRelaciones> {
    const equipo = await this.equipos.buscarPorId(equipoId);
    if (!equipo) throw new ErrorNoEncontrado(`No existe el equipo con id ${equipoId}`);
    return equipo;
  }

  private async traer(equipoId: string, fotoId: string): Promise<Foto> {
    const foto = await this.fotos.buscar(equipoId, fotoId);
    if (!foto) throw new ErrorNoEncontrado('No existe esa foto en este equipo.');
    return foto;
  }

  async listar(equipoId: string): Promise<Foto[]> {
    await this.traerEquipo(equipoId);
    return this.fotos.listar(equipoId);
  }

  async subir(
    equipoId: string,
    contenido: Buffer,
    nombreArchivo: string,
    descripcion: string | null | undefined,
    subidoPorId: string | null,
  ): Promise<Foto> {
    if (!this.almacen.estaConfigurado()) {
      throw new ErrorDatosInvalidos(
        'La carga de fotos no está configurada en el servidor. El resto del módulo funciona igual.',
      );
    }
    await this.traerEquipo(equipoId);
    const limpia = limpiarDescripcion(descripcion);
    validarFoto(contenido, await this.fotos.contar(equipoId));

    const subida = await this.almacen.subir(contenido, nombreArchivo, equipoId);
    try {
      return await this.fotos.crear({
        equipoId,
        url: subida.url,
        ruta: subida.ruta,
        descripcion: limpia,
        subidoPorId,
      });
    } catch (error) {
      // Sin la fila, la imagen subida no la encuentra nadie y ocupa lugar.
      await this.almacen.borrar(subida.ruta);
      throw error;
    }
  }

  async cambiarDescripcion(
    equipoId: string,
    fotoId: string,
    descripcion: string | null | undefined,
  ): Promise<Foto> {
    const foto = await this.traer(equipoId, fotoId);
    return this.fotos.cambiarDescripcion(foto.id, limpiarDescripcion(descripcion));
  }

  /**
   * Esta pasa a ser la principal, y la que era principal queda entre las
   * otras. No se borra ninguna imagen: solo cambian de lugar.
   */
  async hacerPrincipal(equipoId: string, fotoId: string): Promise<void> {
    const equipo = await this.traerEquipo(equipoId);
    const foto = await this.traer(equipoId, fotoId);
    await this.fotos.intercambiarConPrincipal(foto, equipo.fotoUrl);
  }

  /**
   * Primero la fila y después el archivo: si fallara borrar el archivo, queda
   * uno huérfano, que es menos grave que una fila que apunta a algo que ya no
   * está.
   */
  async borrar(equipoId: string, fotoId: string): Promise<void> {
    const foto = await this.traer(equipoId, fotoId);
    await this.fotos.eliminar(foto.id);
    // Sin ruta (una principal vieja con una dirección de otro lado) no hay
    // nada nuestro que borrar.
    if (foto.ruta && this.almacen.estaConfigurado()) await this.almacen.borrar(foto.ruta);
  }
}
