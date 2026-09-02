import { Criticidad, Equipo, normalizarCodigoInterno, normalizarTexto } from '../dominio/equipo';
import { ErrorConflicto, ErrorDatosInvalidos, ErrorNoEncontrado } from '../dominio/errores';
import { EstadoEquipo, transicionar } from '../dominio/estado-equipo';
import { EquipoConRelaciones, RepositorioEquipos } from '../puertos/repositorio-equipos';

export interface CambiosEquipo {
  nombre?: string;
  codigoInterno?: string | null;
  descripcion?: string | null;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  ubicacionId?: string | null;
  tipoId?: string | null;
  estado?: EstadoEquipo;
  criticidad?: Criticidad;
  fotoUrl?: string | null;
  proveedorId?: string | null;
  horasUso?: number | null;
  fechaAlta?: Date | null;
  garantiaHasta?: Date | null;
}

/**
 * Editar un equipo.
 *
 * Solo se tocan los campos que vinieron. `undefined` significa "no lo mandaron"
 * y `null` significa "borralo": si se confundieran, guardar la ficha con un
 * campo oculto la borraría sin que nadie lo pida.
 */
export class ActualizarEquipo {
  constructor(private readonly repo: RepositorioEquipos) {}

  async ejecutar(id: string, cambios: CambiosEquipo): Promise<EquipoConRelaciones> {
    const actual = await this.repo.buscarPorId(id);
    if (!actual) throw new ErrorNoEncontrado(`No existe el equipo con id ${id}`);

    const parche: Partial<Omit<Equipo, 'id'>> = {};

    if (cambios.nombre !== undefined) {
      const nombre = normalizarTexto(cambios.nombre);
      if (nombre === null) throw new ErrorDatosInvalidos('El equipo necesita un nombre.');
      parche.nombre = nombre;
    }

    if (cambios.codigoInterno !== undefined) {
      const codigo = normalizarCodigoInterno(cambios.codigoInterno);
      if (codigo !== null && codigo !== actual.codigoInterno) {
        const existente = await this.repo.buscarPorCodigoInterno(codigo);
        // Encontrarse a sí mismo no es un choque.
        if (existente && existente.id !== id) {
          throw new ErrorConflicto(
            `El código "${codigo}" ya lo usa el equipo "${existente.nombre}".`,
          );
        }
      }
      parche.codigoInterno = codigo;
    }

    // El estado pasa por la máquina de estados: es la única forma de que
    // "dado de baja es terminal" se cumpla venga por donde venga el cambio.
    if (cambios.estado !== undefined) {
      parche.estado = transicionar(actual.estado, cambios.estado);
    }

    if (cambios.horasUso !== undefined) {
      if (cambios.horasUso !== null && cambios.horasUso < 0) {
        throw new ErrorDatosInvalidos('Las horas de uso no pueden ser negativas.');
      }
      parche.horasUso = cambios.horasUso;
    }

    for (const campo of ['descripcion', 'marca', 'modelo', 'numeroSerie'] as const) {
      if (cambios[campo] !== undefined) parche[campo] = normalizarTexto(cambios[campo]);
    }

    for (const campo of ['ubicacionId', 'tipoId', 'proveedorId', 'fotoUrl'] as const) {
      if (cambios[campo] !== undefined) parche[campo] = cambios[campo] ?? null;
    }

    for (const campo of ['fechaAlta', 'garantiaHasta'] as const) {
      if (cambios[campo] !== undefined) parche[campo] = cambios[campo] ?? null;
    }

    if (cambios.criticidad !== undefined) parche.criticidad = cambios.criticidad;

    return this.repo.actualizar(id, parche);
  }
}
