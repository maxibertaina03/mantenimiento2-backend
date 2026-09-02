import { Intervencion } from '../dominio/intervencion';

/** Una intervención con los nombres de quienes participaron, para mostrarla. */
export interface IntervencionConRelaciones extends Intervencion {
  usuarioNombre: string | null;
  proveedorNombre: string | null;
  registradoPorNombre: string | null;
}

export interface RepositorioIntervenciones {
  crear(intervencion: Omit<Intervencion, 'id' | 'creadoEn'>): Promise<IntervencionConRelaciones>;
  /** El historial de un equipo, de la más reciente a la más vieja. */
  listarPorEquipo(equipoId: string): Promise<IntervencionConRelaciones[]>;
  buscarPorId(id: string): Promise<IntervencionConRelaciones | null>;
}

export const REPOSITORIO_INTERVENCIONES = Symbol('RepositorioIntervenciones');
