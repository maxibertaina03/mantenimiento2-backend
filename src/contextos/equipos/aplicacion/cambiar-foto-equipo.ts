import { ErrorDatosInvalidos, ErrorNoEncontrado } from '../dominio/errores';
import { AlmacenImagenes } from '../puertos/almacen-imagenes';
import { EquipoConRelaciones, RepositorioEquipos } from '../puertos/repositorio-equipos';

/** 5 MB ya comprimida. El navegador la achica antes de mandarla. */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Cambiar la foto de un equipo.
 *
 * Sube primero y actualiza la ficha después: si se hiciera al revés y la subida
 * fallara, la ficha quedaría apuntando a una imagen que no existe.
 *
 * La foto anterior se borra recién cuando la nueva ya está guardada y la ficha
 * la apunta. Borrarla antes dejaría al equipo sin foto si algo falla en el medio.
 */
export class CambiarFotoEquipo {
  constructor(
    private readonly equipos: RepositorioEquipos,
    private readonly almacen: AlmacenImagenes,
  ) {}

  async ejecutar(
    id: string,
    contenido: Buffer,
    nombreArchivo: string,
  ): Promise<EquipoConRelaciones> {
    if (!this.almacen.estaConfigurado()) {
      throw new ErrorDatosInvalidos(
        'La carga de fotos no está configurada en el servidor. El resto del módulo funciona igual.',
      );
    }
    if (contenido.length === 0) {
      throw new ErrorDatosInvalidos('La imagen vino vacía.');
    }
    if (contenido.length > MAX_BYTES) {
      throw new ErrorDatosInvalidos(
        `La imagen pesa ${Math.round(contenido.length / 1024 / 1024)} MB y el máximo son 5 MB.`,
      );
    }

    const equipo = await this.equipos.buscarPorId(id);
    if (!equipo) throw new ErrorNoEncontrado(`No existe el equipo con id ${id}`);

    const anterior = equipo.fotoUrl;
    const subida = await this.almacen.subir(contenido, nombreArchivo, id);
    const actualizado = await this.equipos.actualizar(id, { fotoUrl: subida.url });

    // Recién ahora: la ficha ya apunta a la nueva.
    if (anterior) {
      const rutaAnterior = anterior.split('/object/public/')[1]?.split('/').slice(1).join('/');
      if (rutaAnterior) await this.almacen.borrar(rutaAnterior);
    }

    return actualizado;
  }
}
