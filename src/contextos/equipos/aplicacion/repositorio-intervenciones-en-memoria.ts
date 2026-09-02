import { Intervencion } from '../dominio/intervencion';
import {
  IntervencionConRelaciones,
  RepositorioIntervenciones,
} from '../puertos/repositorio-intervenciones';

/** Implementación en memoria del puerto, para probar sin base de datos. */
export class RepositorioIntervencionesEnMemoria implements RepositorioIntervenciones {
  readonly filas: IntervencionConRelaciones[] = [];
  private secuencia = 0;

  async crear(
    intervencion: Omit<Intervencion, 'id' | 'creadoEn'>,
  ): Promise<IntervencionConRelaciones> {
    const fila: IntervencionConRelaciones = {
      ...intervencion,
      id: `int-${++this.secuencia}`,
      creadoEn: new Date(),
      usuarioNombre: intervencion.usuarioId ? 'Usuario de prueba' : null,
      proveedorNombre: intervencion.proveedorId ? 'Proveedor de prueba' : null,
      registradoPorNombre: null,
    };
    this.filas.push(fila);
    return fila;
  }

  async listarPorEquipo(equipoId: string): Promise<IntervencionConRelaciones[]> {
    // De la más reciente a la más vieja, como la muestra la ficha.
    return this.filas
      .filter((f) => f.equipoId === equipoId)
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }

  async buscarPorId(id: string): Promise<IntervencionConRelaciones | null> {
    return this.filas.find((f) => f.id === id) ?? null;
  }
}
