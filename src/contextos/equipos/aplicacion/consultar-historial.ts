import { ErrorNoEncontrado } from '../dominio/errores';
import { ResumenMantenimiento, resumirMantenimiento } from '../dominio/intervencion';
import {
  IntervencionConRelaciones,
  RepositorioIntervenciones,
} from '../puertos/repositorio-intervenciones';
import { RepositorioEquipos } from '../puertos/repositorio-equipos';

export interface HistorialEquipo {
  intervenciones: IntervencionConRelaciones[];
  resumen: ResumenMantenimiento;
}

/**
 * El historial de un equipo con su resumen.
 *
 * El resumen se calcula al leer y no se guarda: un total acumulado en la ficha
 * habría que recalcularlo con cada alta, y bastaría un error para que quede
 * desfasado sin que nadie lo note.
 */
export class ConsultarHistorial {
  constructor(
    private readonly intervenciones: RepositorioIntervenciones,
    private readonly equipos: RepositorioEquipos,
  ) {}

  async ejecutar(equipoId: string): Promise<HistorialEquipo> {
    const equipo = await this.equipos.buscarPorId(equipoId);
    if (!equipo) throw new ErrorNoEncontrado(`No existe el equipo con id ${equipoId}`);

    const intervenciones = await this.intervenciones.listarPorEquipo(equipoId);
    return { intervenciones, resumen: resumirMantenimiento(intervenciones) };
  }
}
