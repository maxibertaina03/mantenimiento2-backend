import { ErrorDatosInvalidos, ErrorNoEncontrado } from '../dominio/errores';
import { nombreParaMostrar, validarManual } from '../dominio/manual';
import { AlmacenManuales, Manual, RepositorioManuales } from '../puertos/manuales';
import { Reloj } from '../puertos/reloj';
import { RepositorioEquipos } from '../puertos/repositorio-equipos';

/** Lo que dura el enlace para abrir un manual. */
const SEGUNDOS_DEL_ENLACE = 300;

/**
 * Los manuales en PDF de un equipo o una herramienta: subirlos, abrirlos y
 * borrarlos.
 */
export class GestionarManuales {
  constructor(
    private readonly manuales: RepositorioManuales,
    private readonly almacen: AlmacenManuales,
    private readonly equipos: RepositorioEquipos,
    private readonly reloj: Reloj,
  ) {}

  private async verificarEquipo(equipoId: string): Promise<void> {
    if (!(await this.equipos.buscarPorId(equipoId))) {
      throw new ErrorNoEncontrado(`No existe el equipo con id ${equipoId}`);
    }
  }

  private async traer(equipoId: string, manualId: string): Promise<Manual> {
    const manual = await this.manuales.buscar(equipoId, manualId);
    if (!manual) throw new ErrorNoEncontrado('No existe ese manual en este equipo.');
    return manual;
  }

  private exigirAlmacen(): void {
    if (!this.almacen.estaConfigurado()) {
      throw new ErrorDatosInvalidos(
        'Este servidor no tiene configurado dónde guardar archivos, así que no se pueden ' +
          'subir ni abrir manuales. El resto del módulo funciona igual.',
      );
    }
  }

  estaDisponible(): boolean {
    return this.almacen.estaConfigurado();
  }

  async listar(equipoId: string): Promise<Manual[]> {
    await this.verificarEquipo(equipoId);
    return this.manuales.listar(equipoId);
  }

  async subir(
    equipoId: string,
    contenido: Buffer,
    nombreArchivo: string,
    subidoPorId: string | null,
  ): Promise<Manual> {
    this.exigirAlmacen();
    await this.verificarEquipo(equipoId);

    const nombre = nombreParaMostrar(nombreArchivo);
    validarManual(nombre, contenido, await this.manuales.contar(equipoId));

    const { ruta } = await this.almacen.subir(contenido, nombre, equipoId);
    try {
      return await this.manuales.crear({
        equipoId,
        nombre,
        ruta,
        tamanoBytes: contenido.length,
        subidoPorId,
      });
    } catch (error) {
      // Sin la fila, el archivo subido no lo encuentra nadie y ocupa lugar.
      await this.almacen.borrar(ruta);
      throw error;
    }
  }

  /**
   * Un enlace para abrir el PDF, que vence a los cinco minutos.
   *
   * No una dirección fija: esa quedaría andando para siempre en cualquier
   * lugar donde alguien la pegue.
   */
  async enlace(equipoId: string, manualId: string): Promise<{ url: string; vence: Date }> {
    this.exigirAlmacen();
    const manual = await this.traer(equipoId, manualId);
    return {
      url: await this.almacen.enlace(manual.ruta, SEGUNDOS_DEL_ENLACE),
      vence: new Date(this.reloj.ahora().getTime() + SEGUNDOS_DEL_ENLACE * 1000),
    };
  }

  /**
   * Primero la fila y después el archivo: si fallara borrar el archivo, queda
   * uno huérfano, que es menos grave que una fila que apunta a algo que ya no
   * está.
   */
  async borrar(equipoId: string, manualId: string): Promise<void> {
    const manual = await this.traer(equipoId, manualId);
    await this.manuales.eliminar(manual.id);
    if (this.almacen.estaConfigurado()) await this.almacen.borrar(manual.ruta);
  }
}
