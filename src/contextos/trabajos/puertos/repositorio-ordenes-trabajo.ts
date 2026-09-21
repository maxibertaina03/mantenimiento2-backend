import {
  EstadoOrdenTrabajo,
  MaterialUsado,
  OrdenTrabajo,
  TipoTrabajo,
} from '../dominio/orden-trabajo';

/** Un material usado, con lo necesario para mostrarlo sin ir a buscarlo otra vez. */
export interface MaterialUsadoConRelaciones extends MaterialUsado {
  materialNombre: string;
  unidad: string;
}

/** La orden con los nombres ya resueltos, lista para la pantalla. */
export interface OrdenTrabajoConRelaciones extends OrdenTrabajo {
  equipoNombre: string | null;
  equipoCodigo: string | null;
  abiertaPorNombre: string | null;
  cerradaPorNombre: string | null;
  materiales: MaterialUsadoConRelaciones[];
}

export interface FiltroOrdenesTrabajo {
  estado?: EstadoOrdenTrabajo;
  tipo?: TipoTrabajo;
  equipoId?: string;
  /** Busca en el número, el título y la descripción. */
  buscar?: string;
  desde?: Date;
  hasta?: Date;
}

export interface RepositorioOrdenesTrabajo {
  /** Guarda la orden y le asigna el correlativo (OT-2026-0001) de forma atómica. */
  crear(
    orden: Omit<OrdenTrabajo, 'id' | 'numero' | 'creadoEn'>,
  ): Promise<OrdenTrabajoConRelaciones>;

  buscarPorId(id: string): Promise<OrdenTrabajoConRelaciones | null>;
  listar(
    filtro: FiltroOrdenesTrabajo,
    skip: number,
    take: number,
  ): Promise<OrdenTrabajoConRelaciones[]>;
  contar(filtro: FiltroOrdenesTrabajo): Promise<number>;

  /** Aplica los cambios que devolvió el dominio (cerrar, reabrir, anular, editar). */
  actualizar(id: string, cambios: Partial<OrdenTrabajo>): Promise<OrdenTrabajoConRelaciones>;

  agregarMaterial(
    material: Omit<MaterialUsado, 'id' | 'creadoEn'>,
  ): Promise<MaterialUsadoConRelaciones>;
  buscarMaterialUsado(id: string): Promise<MaterialUsado | null>;
  quitarMaterial(id: string): Promise<void>;
}

export const REPOSITORIO_ORDENES_TRABAJO = Symbol('RepositorioOrdenesTrabajo');
