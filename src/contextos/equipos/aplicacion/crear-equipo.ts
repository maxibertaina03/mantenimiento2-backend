import { DatosNuevoEquipo, crearEquipo } from '../dominio/equipo';
import { ErrorConflicto } from '../dominio/errores';
import { EquipoConRelaciones, RepositorioEquipos } from '../puertos/repositorio-equipos';

/**
 * Dar de alta un equipo.
 *
 * El caso de uso no valida los datos —eso es del dominio— ni sabe cómo se
 * guardan —eso es del repositorio—. Lo suyo es el orden: validar, comprobar
 * que el código no esté tomado, guardar.
 */
export class CrearEquipo {
  constructor(private readonly repo: RepositorioEquipos) {}

  async ejecutar(datos: DatosNuevoEquipo): Promise<EquipoConRelaciones> {
    const equipo = crearEquipo(datos);

    // Se comprueba antes de intentar guardar para poder decir qué equipo está
    // usando el código. La base igual tiene el índice único: esto es para el
    // mensaje, no para la garantía.
    if (equipo.codigoInterno !== null) {
      const existente = await this.repo.buscarPorCodigoInterno(equipo.codigoInterno);
      if (existente) {
        throw new ErrorConflicto(
          `El código "${equipo.codigoInterno}" ya lo usa el equipo "${existente.nombre}".`,
        );
      }
    }

    return this.repo.crear(equipo);
  }
}
