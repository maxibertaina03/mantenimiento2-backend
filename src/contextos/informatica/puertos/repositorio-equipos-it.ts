import { EstadoEquipoIt, TipoAccesoRemoto, TipoDisco } from '../dominio/equipo-it';

/**
 * Un equipo de informática con los nombres ya resueltos.
 *
 * Es la forma que sale del repositorio y la que usa la pantalla. Los nombres
 * de los catálogos vienen ya puestos —marca, modelo, ubicación, quién lo
 * tiene— para que nadie más tenga que ir a buscarlos.
 */
export interface EquipoItConRelaciones {
  id: string;
  codigoInterno: string | null;
  tipoId: string;
  tipoNombre: string | null;
  /** Si el formulario tiene que pedir procesador, RAM y disco. */
  llevaEspecificaciones: boolean;
  estado: EstadoEquipoIt;
  qrGeneradoEn: Date | null;
  marcaId: string | null;
  marcaNombre: string | null;
  modeloId: string | null;
  modeloNombre: string | null;
  numeroSerie: string | null;
  procesador: string | null;
  memoriaRamGb: number | null;
  discoTipo: TipoDisco | null;
  discoCapacidadGb: number | null;
  sistemaOperativo: string | null;
  direccionIp: string | null;
  direccionMac: string | null;
  nombreEnRed: string | null;
  accesoRemoto: TipoAccesoRemoto;
  accesoRemotoId: string | null;
  ubicacionId: string | null;
  ubicacionNombre: string | null;
  proveedorId: string | null;
  proveedorNombre: string | null;
  fechaCompra: Date | null;
  garantiaHasta: Date | null;
  notas: string | null;
  responsableId: string | null;
  responsableNombre: string | null;
  creadoEn: Date;
}

/**
 * Lo que se escribe de un equipo.
 *
 * Todo opcional salvo el tipo: al editar se manda solo lo que cambió, y un
 * campo en `undefined` quiere decir "no tocar", no "borrar".
 */
export interface DatosEquipoIt {
  codigoInterno?: string | null;
  tipoId?: string;
  estado?: EstadoEquipoIt;
  marcaId?: string | null;
  modeloId?: string | null;
  numeroSerie?: string | null;
  procesador?: string | null;
  memoriaRamGb?: number | null;
  discoTipo?: TipoDisco | null;
  discoCapacidadGb?: number | null;
  sistemaOperativo?: string | null;
  direccionIp?: string | null;
  direccionMac?: string | null;
  nombreEnRed?: string | null;
  accesoRemoto?: TipoAccesoRemoto;
  accesoRemotoId?: string | null;
  ubicacionId?: string | null;
  fechaCompra?: Date | null;
  garantiaHasta?: Date | null;
  notas?: string | null;
  proveedorId?: string | null;
  responsableId?: string | null;
}

export interface FiltroEquiposIt {
  buscar?: string;
  tipoId?: string;
  estado?: EstadoEquipoIt;
  responsableId?: string;
  marcaId?: string;
  ubicacionId?: string;
  /** Solo los que no tienen responsable. Gana sobre `responsableId`. */
  sinResponsable?: boolean;
  /** Solo los que todavía no tienen la etiqueta QR impresa. */
  sinQr?: boolean;
}

/** Un cambio de manos, con todo lo que hace falta para dejarlo en el historial. */
export interface DatosAsignacion {
  equipoId: string;
  responsableId: string | null;
  registradoPorId: string | null;
  motivo?: string | null;
  notas?: string | null;
  /** En qué estado queda el equipo después del movimiento. */
  estadoResultante: EstadoEquipoIt;
}

/** Un tramo del historial: quién tuvo el equipo y entre qué fechas. */
export interface AsignacionIt {
  id: string;
  responsableId: string | null;
  responsableNombre: string | null;
  registradoPorNombre: string | null;
  desde: Date;
  hasta: Date | null;
  motivo: string | null;
  notas: string | null;
}

export interface ResumenEquiposIt {
  porTipo: { tipoId: string; nombre: string; cantidad: number }[];
  porEstado: { estado: EstadoEquipoIt; cantidad: number }[];
  total: number;
}

export interface RepositorioEquiposIt {
  buscarPorId(id: string): Promise<EquipoItConRelaciones | null>;
  buscarPorCodigoInterno(codigoInterno: string): Promise<EquipoItConRelaciones | null>;
  listar(filtro: FiltroEquiposIt, skip: number, take: number): Promise<EquipoItConRelaciones[]>;
  contar(filtro: FiltroEquiposIt): Promise<number>;

  crear(datos: DatosEquipoIt & { tipoId: string }): Promise<EquipoItConRelaciones>;
  actualizar(id: string, datos: DatosEquipoIt): Promise<EquipoItConRelaciones>;
  eliminar(id: string): Promise<void>;

  /**
   * Cierra el tramo vigente, abre uno nuevo y deja el equipo apuntando a quien
   * lo tiene ahora. En una sola transacción: separados pueden dejar dos tramos
   * abiertos a la vez, y el historial dejaría de decir quién lo tiene.
   */
  reasignar(datos: DatosAsignacion): Promise<EquipoItConRelaciones>;
  listarAsignaciones(equipoId: string): Promise<AsignacionIt[]>;

  marcarQrGenerado(ids: string[], cuando: Date): Promise<number>;
  resumen(): Promise<ResumenEquiposIt>;
}

export const REPOSITORIO_EQUIPOS_IT = Symbol('RepositorioEquiposIt');
