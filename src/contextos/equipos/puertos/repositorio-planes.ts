import { PlanMantenimiento } from '../dominio/plan-mantenimiento';

/** Un plan con los datos del equipo, para la pantalla de servicios que vencen. */
export interface PlanConEquipo extends PlanMantenimiento {
  equipoNombre: string;
  equipoEstado: string;
  ubicacionNombre: string | null;
}

export interface RepositorioPlanes {
  crear(plan: Omit<PlanMantenimiento, 'id'>): Promise<PlanMantenimiento>;
  actualizar(
    id: string,
    cambios: Partial<Omit<PlanMantenimiento, 'id'>>,
  ): Promise<PlanMantenimiento>;
  buscarPorId(id: string): Promise<PlanMantenimiento | null>;
  listarPorEquipo(equipoId: string): Promise<PlanMantenimiento[]>;
  /**
   * Los planes activos que vencen antes de una fecha, con su equipo.
   *
   * El corte va en la consulta y no en memoria: son 326 equipos que pueden
   * tener varios planes cada uno, y traerlos todos para descartar la mayoría
   * sería tirar trabajo a la basura en cada aviso diario.
   */
  listarQueVencenHasta(fechaCorte: Date): Promise<PlanConEquipo[]>;
  eliminar(id: string): Promise<void>;
}

export const REPOSITORIO_PLANES = Symbol('RepositorioPlanes');
