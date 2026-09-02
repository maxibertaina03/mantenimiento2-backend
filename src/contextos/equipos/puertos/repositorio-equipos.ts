import { Criticidad, Equipo } from '../dominio/equipo';
import { EstadoEquipo } from '../dominio/estado-equipo';

/** Un equipo con los nombres de sus relaciones, para mostrarlo sin más consultas. */
export interface EquipoConRelaciones extends Equipo {
  ubicacionNombre: string | null;
  tipoNombre: string | null;
  proveedorNombre: string | null;
}

/** Cómo se pide el listado. Con ~250 equipos, filtrar en memoria no es opción. */
export interface FiltroEquipos {
  buscar?: string;
  ubicacionId?: string;
  tipoId?: string;
  estado?: EstadoEquipo;
  criticidad?: Criticidad;
  /** Solo los que ya no están en garantía, comparando contra esta fecha. */
  garantiaVencidaAl?: Date;
  ordenarPor?: 'nombre' | 'codigo' | 'ubicacion' | 'criticidad';
  direccion?: 'asc' | 'desc';
  skip: number;
  take: number;
}

export interface PaginaEquipos {
  datos: EquipoConRelaciones[];
  total: number;
}

/**
 * Lo que el contexto de Equipos necesita para guardar y recuperar equipos.
 *
 * Es una interfaz y no la clase de Prisma a propósito: los casos de uso se
 * prueban con una implementación en memoria, sin base de datos, y si algún día
 * cambia el motor solo se reemplaza el adaptador.
 */
export interface RepositorioEquipos {
  crear(equipo: Omit<Equipo, 'id'>): Promise<EquipoConRelaciones>;
  actualizar(id: string, cambios: Partial<Omit<Equipo, 'id'>>): Promise<EquipoConRelaciones>;
  buscarPorId(id: string): Promise<EquipoConRelaciones | null>;
  /** Para validar que el código no esté repetido antes de guardar. */
  buscarPorCodigoInterno(codigo: string): Promise<Equipo | null>;
  /**
   * Lo que hace idempotente a la importación: los equipos importados no traen
   * código, así que la identidad es el nombre dentro de su ubicación.
   */
  buscarPorNombreYUbicacion(nombre: string, ubicacionId: string): Promise<Equipo | null>;
  /**
   * Los nombres ya cargados en esas ubicaciones, en UNA consulta.
   *
   * Existe por una caída real: preguntando fila por fila, importar 341 equipos
   * eran 682 viajes a una base que está en otro continente, y el proceso se
   * murió a los 129.
   */
  listarNombresPorUbicaciones(
    ubicacionIds: string[],
  ): Promise<{ nombre: string; ubicacionId: string }[]>;
  /** Inserta una tanda. Devuelve cuántos entraron. */
  crearVarios(equipos: Omit<Equipo, 'id'>[]): Promise<number>;
  listar(filtro: FiltroEquipos): Promise<PaginaEquipos>;
  eliminar(id: string): Promise<void>;
}

export const REPOSITORIO_EQUIPOS = Symbol('RepositorioEquipos');
