import { ErrorNoEncontrado } from '../dominio/errores';
import { DatosNuevaIntervencion, crearIntervencion } from '../dominio/intervencion';
import {
  IntervencionConRelaciones,
  RepositorioIntervenciones,
} from '../puertos/repositorio-intervenciones';
import { RepositorioEquipos } from '../puertos/repositorio-equipos';
import { Reloj } from '../puertos/reloj';

/**
 * Registrar un trabajo hecho sobre un equipo.
 *
 * Trae el equipo antes de validar porque la regla "un equipo dado de baja no
 * recibe intervenciones" necesita saber en qué estado está. Es el dominio el
 * que decide; el caso de uso solo le acerca el dato.
 */
export class RegistrarIntervencion {
  constructor(
    private readonly intervenciones: RepositorioIntervenciones,
    private readonly equipos: RepositorioEquipos,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(datos: DatosNuevaIntervencion): Promise<IntervencionConRelaciones> {
    const equipo = await this.equipos.buscarPorId(datos.equipoId);
    if (!equipo) throw new ErrorNoEncontrado(`No existe el equipo con id ${datos.equipoId}`);

    return this.intervenciones.crear(crearIntervencion(datos, equipo.estado, this.reloj.ahora()));
  }
}
