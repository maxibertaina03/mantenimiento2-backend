import { Decimal } from '../../../common/dominio/decimal';
import type { ClasificacionEquipo } from '../../../common/dominio/renglon-de-compra';
import type { EstadoOrdenCompra } from '../dominio/orden-compra';

/**
 * Puerto del repositorio de órdenes de compra.
 *
 * Recibir es la operación delicada: suma el stock de cada material, da de alta
 * las fichas de los equipos y cierra la orden, todo en UNA transacción. Por
 * eso queda entera del lado del adaptador —con el lock de cada material,
 * igual que un movimiento cargado a mano— y el caso de uso solo le pasa lo que
 * ya decidió el dominio.
 */

export type ViaEnvioOrden = 'CORREO' | 'WHATSAPP';

export interface FiltroOrdenes {
  buscar?: string;
  estado?: EstadoOrdenCompra;
  proveedorId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
}

export interface DatosRenglon {
  /** Nulo cuando el renglon es de un equipo y no de un material del paniol. */
  materialId: string | null;
  cantidad: Decimal;
  precioUnitario?: Decimal | null;
  notas?: string | null;

  /** Lo del equipo. La ficha se crea recien al recibir la mercaderia. */
  descripcionEquipo?: string | null;
  clasificacion?: ClasificacionEquipo | null;
  equipoTipoId?: string | null;
  equipoMarcaId?: string | null;
  equipoModeloId?: string | null;
}

export interface DatosCrearOrden {
  proveedorId: string;
  observaciones?: string | null;
  creadoPorId?: string | null;
  renglones: DatosRenglon[];
}

/** Un renglón tal como está guardado. */
export interface RenglonConRelaciones {
  id: string;
  materialId: string | null;
  cantidad: Decimal;
  precioUnitario: Decimal | null;
  notas: string | null;
  movimientoId: string | null;
  material?: { nombre: string; unidad?: { simbolo: string } | null } | null;
}

/** Una orden tal como está guardada, con los nombres de lo que referencia. */
export interface OrdenConRelaciones {
  id: string;
  numero: string;
  estado: EstadoOrdenCompra;
  proveedorId: string;
  fecha: Date;
  observaciones: string | null;
  emitidaEn: Date | null;
  recibidaEn: Date | null;
  remito: string | null;
  factura: string | null;
  creadoEn: Date;
  proveedor?: {
    nombre: string;
    cuit: string | null;
    email: string | null;
    telefono: string | null;
  } | null;
  creadoPor?: { nombre: string } | null;
  recibidaPor?: { nombre: string } | null;
  renglones?: RenglonConRelaciones[];
}

export interface EnvioConUsuario {
  id: string;
  via: ViaEnvioOrden;
  destinatarios: string;
  automatico: boolean;
  enviadoEn: Date;
  usuario?: { nombre: string } | null;
}

export interface DatosRecepcion {
  id: string;
  fechaRecepcion: Date;
  recibidaPorId: string | null;
  referencia: string;
  remito: string | null;
  factura: string | null;
  notas?: string | null;
}

export interface RepositorioOrdenesCompra {
  /** Crea la orden con sus renglones y le asigna el número correlativo. */
  crear(datos: DatosCrearOrden): Promise<OrdenConRelaciones>;
  buscarConFiltros(
    filtro: FiltroOrdenes,
    skip: number,
    take: number,
  ): Promise<OrdenConRelaciones[]>;
  contar(filtro: FiltroOrdenes): Promise<number>;
  buscarPorId(id: string): Promise<OrdenConRelaciones | null>;
  /** Reemplaza los renglones y los datos de cabecera (solo en BORRADOR). */
  actualizar(id: string, datos: Partial<DatosCrearOrden>): Promise<OrdenConRelaciones>;
  /** Deja constancia de un envío y, si la orden estaba en BORRADOR, la emite. */
  registrarEnvio(params: {
    ordenId: string;
    via: ViaEnvioOrden;
    destinatarios: string;
    automatico: boolean;
    usuarioId: string | null;
  }): Promise<OrdenConRelaciones>;
  listarEnvios(ordenId: string): Promise<EnvioConUsuario[]>;
  cambiarEstado(
    id: string,
    estado: EstadoOrdenCompra,
    extra?: { emitidaEn?: Date },
  ): Promise<OrdenConRelaciones>;
  /**
   * Cierra la orden: una ENTRADA por renglón de material, una ficha por unidad
   * de equipo, y la orden RECIBIDA. Todo o nada.
   */
  recibir(datos: DatosRecepcion): Promise<OrdenConRelaciones>;
  eliminar(id: string): Promise<unknown>;
}
