import { Decimal } from '../../../common/dominio/decimal';
import { MotivoMovimiento, TipoMovimiento } from '../dominio/movimiento';

/**
 * Puerto del repositorio de materiales.
 *
 * Habla en el idioma del pañol —"los que no tienen etiqueta", "los que faltan
 * ubicar"—, no en el de Prisma. La traducción a un `where` vive en el
 * adaptador, que es el único que sabe cómo se guarda.
 */
export const REPOSITORIO_MATERIALES = Symbol('REPOSITORIO_MATERIALES');

/** Un material tal como está guardado, con los nombres de lo que referencia. */
export interface MaterialConRelaciones {
  id: string;
  nombre: string;
  categoriaId: string;
  unidadId: string | null;
  stockActual: Decimal;
  stockMinimo: Decimal;
  activo: boolean;
  estanteriaId: string | null;
  fila: number | null;
  qrGeneradoEn: Date | null;
  notas: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
  categoria?: { nombre: string } | null;
  unidad?: { nombre: string; simbolo: string } | null;
  estanteria?: { nombre: string } | null;
}

/** Un renglón del historial del material. */
export interface MovimientoDelHistorial {
  id: string;
  tipo: TipoMovimiento;
  motivo: MotivoMovimiento;
  cantidad: Decimal;
  fecha: Date;
  proveedorId: string | null;
  usuarioId: string | null;
  referenciaTrabajo: string | null;
  notas: string | null;
}

export type MaterialConHistorial = MaterialConRelaciones & {
  movimientos: MovimientoDelHistorial[];
};

/**
 * Qué materiales mostrar.
 *
 * `mostrar` sin valor significa "los activos": con novecientos en el
 * catálogo, arrastrar los jubilados en cada búsqueda es justo lo que se evita.
 */
export interface FiltroMateriales {
  mostrar?: 'activos' | 'inactivos' | 'todos';
  buscar?: string;
  categoriaId?: string;
  /** Gana sobre `unidadId`: pedir las dos cosas es contradictorio. */
  sinUnidad?: boolean;
  unidadId?: string;
  stockMin?: number;
  stockMax?: number;
  estanteriaId?: string;
  /** Los que todavía no se ubicaron: gana sobre `estanteriaId`. */
  sinUbicacion?: boolean;
  /** Los que faltan etiquetar. */
  sinQr?: boolean;
  /** Solo estos ids. Así se cruza el bajo stock con el resto de los filtros. */
  soloIds?: string[];
}

export type CampoOrdenMaterial = 'nombre' | 'stock' | 'categoria' | 'unidad';

export interface OrdenMateriales {
  campo?: CampoOrdenMaterial;
  direccion?: 'asc' | 'desc';
}

/** Lo que se guarda al dar de alta. El stock arranca en 0: solo cambia por movimientos. */
export interface NuevoMaterial {
  nombre: string;
  stockMinimo: number;
  notas?: string;
  categoriaId: string;
  unidadId: string;
  /** Sin estantería no se guarda fila. */
  ubicacion?: { estanteriaId: string; fila: number | null };
}

/**
 * Lo que cambia al editar. `undefined` es "no se toca".
 *
 * `estanteriaId: null` saca el material de la estantería.
 */
export interface CambiosMaterial {
  nombre?: string;
  stockMinimo?: number;
  notas?: string | null;
  categoriaId?: string;
  unidadId?: string;
  estanteriaId?: string | null;
  fila?: number | null;
  activo?: boolean;
}

export interface RepositorioMateriales {
  /** Los nombres de todos los materiales, para detectar duplicados. */
  listarNombres(): Promise<{ id: string; nombre: string }[]>;
  crear(datos: NuevoMaterial): Promise<MaterialConRelaciones>;
  listar(
    filtro: FiltroMateriales,
    orden: OrdenMateriales,
    skip: number,
    take: number,
  ): Promise<MaterialConRelaciones[]>;
  contar(filtro: FiltroMateriales): Promise<number>;
  buscarPorId(id: string): Promise<MaterialConRelaciones | null>;
  /** Con su historial completo de movimientos, los más recientes primero. */
  buscarConHistorial(id: string): Promise<MaterialConHistorial | null>;
  /** Los activos con un mínimo definido y el stock en o por debajo de él. */
  buscarBajoStock(): Promise<MaterialConRelaciones[]>;
  idsBajoStock(): Promise<string[]>;
  actualizar(id: string, cambios: CambiosMaterial): Promise<MaterialConRelaciones>;
  eliminar(id: string): Promise<void>;
  marcarQrGenerado(ids: string[], cuando: Date): Promise<number>;
  contarSinUnidad(): Promise<number>;
  /** Los activos sin stock mínimo: los que la alerta no puede avisar. */
  contarSinStockMinimo(): Promise<number>;
  /** `soloSinUnidad` completa los huecos sin pisar lo corregido a mano. */
  asignarUnidadMasiva(unidadId: string, soloSinUnidad: boolean): Promise<number>;
  contarMovimientos(id: string): Promise<number>;
}
