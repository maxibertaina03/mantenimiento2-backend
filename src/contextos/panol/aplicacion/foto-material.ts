import { ErrorDatosInvalidos, ErrorNoEncontrado } from '../dominio/errores';
import { rutaDeUrlPublica, validarFotoMaterial } from '../dominio/foto-material';
import { AlmacenFotosMateriales } from '../puertos/almacen-fotos';
import { MaterialConRelaciones, RepositorioMateriales } from '../puertos/repositorio-materiales';

/**
 * La foto de un material: ponerla, cambiarla, sacarla.
 *
 * Igual que con los equipos, sube primero y apunta la ficha después: al revés,
 * si la subida fallara, el material quedaría apuntando a una imagen que no
 * existe. La anterior se borra recién cuando la nueva ya quedó guardada.
 */
export class FotoMaterial {
  constructor(
    private readonly repo: RepositorioMateriales,
    private readonly almacen: AlmacenFotosMateriales,
  ) {}

  estaDisponible(): boolean {
    return this.almacen.estaConfigurado();
  }

  private async buscar(id: string): Promise<MaterialConRelaciones> {
    const material = await this.repo.buscarPorId(id);
    if (!material) throw new ErrorNoEncontrado(`No existe el material con id ${id}`);
    return material;
  }

  private async borrarDelAlmacen(url: string | null): Promise<void> {
    const ruta = url ? rutaDeUrlPublica(url) : null;
    if (ruta) await this.almacen.borrar(ruta);
  }

  async cambiar(
    id: string,
    contenido: Buffer,
    nombreArchivo: string,
  ): Promise<MaterialConRelaciones> {
    if (!this.almacen.estaConfigurado()) {
      throw new ErrorDatosInvalidos(
        'La carga de fotos no está configurada en el servidor. El resto funciona igual.',
      );
    }
    validarFotoMaterial(contenido);
    const material = await this.buscar(id);

    const url = await this.almacen.subir(contenido, nombreArchivo, id);
    const actualizado = await this.repo.actualizar(id, { fotoUrl: url });
    await this.borrarDelAlmacen(material.fotoUrl);
    return actualizado;
  }

  async quitar(id: string): Promise<MaterialConRelaciones> {
    const material = await this.buscar(id);
    if (!material.fotoUrl) return material;

    const actualizado = await this.repo.actualizar(id, { fotoUrl: null });
    await this.borrarDelAlmacen(material.fotoUrl);
    return actualizado;
  }
}
