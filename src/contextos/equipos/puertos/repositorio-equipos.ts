import { Equipo } from '../dominio/equipo';
import { EstadoEquipo } from '../dominio/estado-equipo';
import { ClasificacionEquipo } from '../../../common/dominio/renglon-de-compra';

/** Un equipo con los nombres de sus relaciones, para mostrarlo sin más consultas. */
export interface EquipoConRelaciones extends Equipo {
  ubicacionNombre: string | null;
  tipoNombre: string | null;
  /** Cuándo se imprimió su etiqueta QR. null = todavía no tiene. */
  qrGeneradoEn: Date | null;
  marcaNombre: string | null;
  modeloNombre: string | null;
  proveedorNombre: string | null;
  /** En qué equipo está montado hoy, o null si va suelto. */
  equipoPadreId: string | null;
  equipoPadreNombre: string | null;
  /** Cuántos equipos tiene montados, en el primer nivel. */
  cantidadComponentes: number;
}

/** Cómo se pide el listado. Con ~250 equipos, filtrar en memoria no es opción. */
export interface FiltroEquipos {
  buscar?: string;
  ubicacionId?: string;
  tipoId?: string;
  marcaId?: string;
  modeloId?: string;
  estado?: EstadoEquipo;
  /** Solo maquinas, o solo herramientas. */
  clasificacion?: ClasificacionEquipo;
  /** Solo los que todavía no tienen etiqueta QR generada. */
  sinQr?: boolean;
  /** Solo los que ya no están en garantía, comparando contra esta fecha. */
  garantiaVencidaAl?: Date;
  ordenarPor?: 'nombre' | 'codigo' | 'ubicacion';
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
  /**
   * El estado del parque en una sola consulta.
   *
   * En una y no varias porque lo pide la pantalla de inicio, que se abre todo
   * el tiempo: son 326 equipos y no tiene sentido traerlos para contarlos en
   * memoria cada vez que alguien entra al sistema.
   */
  /**
   * El resumen contado DENTRO de un filtro.
   *
   * Toma un filtro parcial: la paginacion no aplica cuando lo que se cuenta es
   * el total, y el tipo y la ubicacion tampoco, porque son justamente las
   * opciones que hay que ofrecer.
   */
  resumen(filtro?: Partial<FiltroEquipos>): Promise<ResumenEquipos>;
  /**
   * Deja constancia de que a estos equipos ya se les generó la etiqueta QR.
   *
   * En una sola llamada porque las etiquetas se imprimen de a tandas: son 326
   * máquinas y nadie las va a etiquetar de a una.
   */
  marcarQrGenerado(ids: string[], cuando: Date): Promise<number>;
  eliminar(id: string): Promise<void>;
}

/** Cuántos equipos hay y en qué estado, para la pantalla de inicio. */
/**
 * Una opcion de filtro con cuantos equipos tiene DENTRO de lo que ya se filtro.
 *
 * El conteo no es decoracion: el catalogo tiene 49 ubicaciones y solo 16
 * tienen algo, asi que dos de cada tres opciones no llevaban a ningun lado.
 * Con el numero al lado, las vacias no se ofrecen.
 */
export interface OpcionConConteo {
  id: string;
  nombre: string;
  cantidad: number;
}

export interface ResumenEquipos {
  total: number;
  /** Cuantos son maquinas y cuantos herramientas. */
  porClasificacion: Record<string, number>;
  /** Los tipos que tienen algo, dentro del filtro actual. */
  tipos: OpcionConConteo[];
  /** Las ubicaciones que tienen algo, dentro del filtro actual. */
  ubicaciones: OpcionConConteo[];
  /** Equipos sin tipo cargado: no se pueden encontrar con ningun filtro. */
  sinTipo: number;
  /** Cuántos hay en cada estado. Los estados sin equipos no aparecen. */
  porEstado: Record<string, number>;
  /**
   * Equipos que necesitan mantenimiento y no tienen ningún plan activo.
   *
   * Es el número que dice cuánto del parque está fuera del alcance de los
   * avisos: sin plan, un equipo nunca va a generar un recordatorio, y eso no se
   * ve mirando la pantalla de servicios, que justamente lista lo que sí tiene.
   */
  sinPlan: number;
}

export const REPOSITORIO_EQUIPOS = Symbol('RepositorioEquipos');
