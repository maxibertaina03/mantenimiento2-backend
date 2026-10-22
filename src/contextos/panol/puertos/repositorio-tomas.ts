import { RenglonToma, TomaInventario, Ubicacion } from '../dominio/toma-inventario';

export const REPOSITORIO_TOMAS = Symbol('REPOSITORIO_TOMAS');

/** La toma con los nombres ya resueltos y cuánto lleva contado. */
export interface TomaConRelaciones extends TomaInventario {
  categoriaNombre: string | null;
  estanteriaNombre: string | null;
  abiertaPorNombre: string | null;
  cerradaPorNombre: string | null;
  totalRenglones: number;
  contados: number;
}

/** Un renglón con lo que hace falta para contarlo: qué es, dónde está y cuánto figura hoy. */
export interface RenglonConMaterial extends RenglonToma {
  materialNombre: string;
  unidad: string;
  estanteriaId: string | null;
  estanteriaNombre: string | null;
  fila: number | null;
  /** El stock que figura ahora mismo. */
  stockActual: number;
  contadoPorNombre: string | null;
}

/** Un material que se cambió de lugar durante la toma, con los nombres para mostrarlo. */
export interface ReubicacionConNombres {
  id: string;
  materialId: string;
  materialNombre: string;
  desdeEstanteria: string | null;
  desdeFila: number | null;
  haciaEstanteria: string | null;
  haciaFila: number | null;
  hechaEn: Date;
  hechaPorNombre: string | null;
}

export interface RepositorioTomas {
  /** Los materiales en uso del alcance, que van a ser los renglones. */
  materialesDelAlcance(alcance: {
    categoriaId: string | null;
    estanteriaId: string | null;
  }): Promise<string[]>;

  /** Guarda la toma con su número correlativo (TI-2026-0001) y un renglón por material. */
  crear(
    toma: Omit<TomaInventario, 'id' | 'numero'>,
    materialIds: string[],
  ): Promise<TomaConRelaciones>;

  listar(): Promise<TomaConRelaciones[]>;
  buscarPorId(id: string): Promise<TomaConRelaciones | null>;
  actualizar(id: string, cambios: Partial<TomaInventario>): Promise<TomaConRelaciones>;

  /** Ordenados como se recorre el pañol: estantería, fila, nombre. */
  renglones(tomaId: string): Promise<RenglonConMaterial[]>;
  buscarRenglon(id: string): Promise<RenglonConMaterial | null>;
  actualizarRenglon(id: string, cambios: Partial<RenglonToma>): Promise<RenglonConMaterial>;

  /** Si el material tuvo algún movimiento registrado después de ese momento. */
  seMovioDespues(materialId: string, desde: Date): Promise<boolean>;

  /** Si la estantería existe y está en uso. */
  estanteriaActiva(id: string): Promise<boolean>;
  /**
   * Cambia la ubicación del material y deja el registro en la toma, las dos
   * cosas juntas: no puede quedar una sin la otra.
   */
  reubicar(datos: {
    tomaId: string;
    materialId: string;
    desde: Ubicacion;
    hacia: Ubicacion;
    hechaEn: Date;
    hechaPorId: string | null;
  }): Promise<void>;
  /** Lo que se cambió de lugar en la toma, en el orden en que se hizo. */
  reubicaciones(tomaId: string): Promise<ReubicacionConNombres[]>;
}
