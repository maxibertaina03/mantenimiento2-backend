import { EstadoEquipo } from '../dominio/estado-equipo';
import { MaterialParaRepuesto } from '../dominio/repuesto';

/** Un repuesto en la lista de un equipo, con lo que hace falta para ir a buscarlo. */
export interface RepuestoDeEquipo {
  id: string;
  equipoId: string;
  materialId: string;
  materialNombre: string;
  /** Símbolo de la unidad, o "" si el material no tiene una cargada. */
  unidad: string;
  /** Cuántos lleva la máquina, o null si no se dijo. */
  cantidad: number | null;
  notas: string | null;
  /** Lo que hay hoy en el pañol. */
  stockActual: number;
  stockMinimo: number;
  /** La misma regla que el pañol: hay un mínimo y no se llega. */
  bajoStock: boolean;
  /** false si el material se sacó de circulación después de cargarlo. */
  materialActivo: boolean;
  /** Dónde está en el depósito: «Estantería A · fila 3», o null. */
  ubicacion: string | null;
  creadoEn: Date;
}

/** Un equipo que lleva un material, para la ficha del material. */
export interface EquipoQueLoUsa {
  repuestoId: string;
  equipoId: string;
  equipoNombre: string;
  equipoEstado: EstadoEquipo;
  ubicacionNombre: string | null;
  fotoUrl: string | null;
  cantidad: number | null;
  notas: string | null;
}

export interface MaterialDelPanol extends MaterialParaRepuesto {
  id: string;
}

export interface RepositorioRepuestos {
  /** La lista de un equipo, por nombre del material. */
  delEquipo(equipoId: string): Promise<RepuestoDeEquipo[]>;

  /** Los equipos que llevan ese material, por nombre del equipo. */
  equiposQueLoUsan(materialId: string): Promise<EquipoQueLoUsa[]>;

  /** Solo lectura del pañol: si el material existe y si está en uso. */
  buscarMaterial(materialId: string): Promise<MaterialDelPanol | null>;

  buscar(id: string): Promise<{ id: string; equipoId: string; materialId: string } | null>;
  existe(equipoId: string, materialId: string): Promise<boolean>;

  agregar(datos: {
    equipoId: string;
    materialId: string;
    cantidad: number | null;
    notas: string | null;
    registradoPorId: string | null;
  }): Promise<void>;

  actualizar(
    id: string,
    cambios: { cantidad?: number | null; notas?: string | null },
  ): Promise<void>;

  quitar(id: string): Promise<void>;
}

export const REPOSITORIO_REPUESTOS = Symbol('RepositorioRepuestos');
