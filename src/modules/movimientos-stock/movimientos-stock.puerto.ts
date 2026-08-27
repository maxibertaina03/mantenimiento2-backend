import { MotivoMovimiento, TipoMovimiento } from '@prisma/client';
import { Decimal } from '../../common/dominio/decimal';
import { MovimientoConRelaciones } from './dto/movimiento-respuesta.dto';

/**
 * Puerto (interfaz) del repositorio de movimientos.
 *
 * El service depende de ESTA abstracción, no de la implementación Prisma. Eso
 * invierte la dependencia (el dominio deja de conocer la infraestructura) y
 * permite testear el service sin base de datos ni mocks de Prisma.
 */
export const REPOSITORIO_MOVIMIENTOS = Symbol('REPOSITORIO_MOVIMIENTOS');

/** Filtro de listado expresado en lenguaje de dominio (sin tipos de Prisma). */
export interface FiltroMovimientos {
  materialId?: string;
  tipo?: TipoMovimiento;
  motivo?: MotivoMovimiento;
  fechaDesde?: Date;
  fechaHasta?: Date;
}

export interface DatosCrearMovimiento {
  materialId: string;
  tipo: TipoMovimiento;
  motivo: MotivoMovimiento;
  cantidad: Decimal;
  fecha?: Date;
  proveedorId?: string | null;
  usuarioId?: string | null;
  referenciaTrabajo?: string | null;
  notas?: string | null;
}

export interface DatosEditarMovimiento {
  tipo: TipoMovimiento;
  motivo: MotivoMovimiento;
  cantidad: Decimal;
  fecha: Date;
  proveedorId: string | null;
  referenciaTrabajo: string | null;
  notas: string | null;
}

export interface EdicionConUsuario {
  id: string;
  movimientoId: string;
  usuarioId: string | null;
  motivo: string;
  cambios: unknown;
  creadoEn: Date;
  usuario?: { nombre: string } | null;
}

export interface RepositorioMovimientos {
  /**
   * Crea el movimiento y actualiza el stock del material en UNA transacción,
   * tomando lock exclusivo de la fila del material para evitar lost updates.
   * `calcularNuevoStock` aplica la regla de negocio y puede lanzar.
   */
  crearConActualizacionDeStock(
    data: DatosCrearMovimiento,
    calcularNuevoStock: (stockActual: Decimal) => Decimal,
  ): Promise<MovimientoConRelaciones>;

  /**
   * Edita un movimiento, recalcula el stock del material reproduciendo su
   * historial y deja registro de auditoría. `validarStock` puede rechazar el
   * resultado (p. ej. si el recálculo deja el stock negativo).
   */
  editarConAuditoria(params: {
    id: string;
    materialId: string;
    datos: DatosEditarMovimiento;
    edicion: { usuarioId: string | null; motivo: string; cambios: unknown };
    validarStock: (stockRecalculado: Decimal) => void;
  }): Promise<MovimientoConRelaciones>;

  listarEdiciones(movimientoId: string): Promise<EdicionConUsuario[]>;
  buscarConFiltros(
    filtro: FiltroMovimientos,
    skip: number,
    take: number,
  ): Promise<MovimientoConRelaciones[]>;
  contar(filtro: FiltroMovimientos): Promise<number>;
  buscarPorId(id: string): Promise<MovimientoConRelaciones | null>;
}
