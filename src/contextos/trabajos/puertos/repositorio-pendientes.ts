import type { Pendiente } from '../dominio/pendiente';

export const REPOSITORIO_PENDIENTES = Symbol('RepositorioPendientes');

/** Un pendiente con los nombres de lo que referencia, para mostrarlo. */
export interface PendienteConNombres extends Pendiente {
  asignadoANombre: string | null;
  equipoNombre: string | null;
  creadoPorNombre: string | null;
  hechaPorNombre: string | null;
  /** El número de la orden de trabajo (OT-2026-0012), si se registró una. */
  ordenTrabajoNumero: string | null;
}

export interface NuevoPendiente {
  texto: string;
  urgente: boolean;
  asignadoAId: string | null;
  equipoId: string | null;
  creadoPorId: string | null;
}

/** Lo que cambia al editar. `undefined` es «no se toca». */
export interface CambiosPendiente {
  texto?: string;
  urgente?: boolean;
  asignadoAId?: string | null;
  equipoId?: string | null;
  hechaEn?: Date | null;
  hechaPorId?: string | null;
  ordenTrabajoId?: string | null;
}

export interface RepositorioPendientes {
  /** Los que siguen sin hacer. */
  abiertos(): Promise<PendienteConNombres[]>;
  /** Los hechos desde una fecha, los más recientes primero. */
  hechosDesde(desde: Date): Promise<PendienteConNombres[]>;
  buscar(id: string): Promise<PendienteConNombres | null>;
  crear(datos: NuevoPendiente): Promise<PendienteConNombres>;
  actualizar(id: string, cambios: CambiosPendiente): Promise<PendienteConNombres>;
  borrar(id: string): Promise<void>;
  /** De qué máquina es una orden de trabajo; `null` si la orden no existe. */
  equipoDeLaOrden(ordenTrabajoId: string): Promise<{ equipoId: string | null } | null>;
}
