import { aDecimal } from '../../../common/dominio/decimal';
import type { ClasificacionEquipo } from '../../../common/dominio/renglon-de-compra';
import { ErrorNoEncontrado } from '../dominio/errores';
import {
  comprobanteDeRecepcion,
  materialesDeLosRenglones,
  validarEditable,
  validarEliminable,
  validarQueQuedanRenglones,
  validarQueSePuedeEmitir,
  validarTransicion,
} from '../dominio/orden-compra';
import { Reloj, relojDelSistema } from '../puertos/envio';
import { ConsultaProveedores, PanolParaCompras } from '../puertos/otros-contextos';
import {
  DatosRenglon,
  FiltroOrdenes,
  OrdenConRelaciones,
  RepositorioOrdenesCompra,
} from '../puertos/repositorio-ordenes-compra';

/** Un renglón tal como lo pide quien carga la orden. */
export interface RenglonPedido {
  materialId?: string | null;
  cantidad: number;
  precioUnitario?: number;
  notas?: string;
  descripcionEquipo?: string;
  clasificacion?: ClasificacionEquipo;
  equipoTipoId?: string;
  equipoMarcaId?: string;
  equipoModeloId?: string;
}

export interface DatosAltaOrden {
  proveedorId: string;
  observaciones?: string;
  renglones: RenglonPedido[];
}

export interface DatosCambioOrden {
  proveedorId?: string;
  observaciones?: string;
  renglones?: RenglonPedido[];
}

export interface DatosRecibir {
  fechaRecepcion?: Date;
  remito?: string;
  factura?: string;
  notas?: string;
}

/**
 * Las órdenes de compra: de borrador a recibida.
 *
 * Las decisiones las toma el dominio. Este caso de uso le acerca lo que
 * necesita —la orden, si el proveedor existe, qué dice el pañol— y guarda lo
 * que el dominio decide. No conoce Nest, ni Prisma, ni HTTP.
 */
export class GestionarOrdenesCompra {
  constructor(
    private readonly repo: RepositorioOrdenesCompra,
    private readonly proveedores: ConsultaProveedores,
    private readonly panol: PanolParaCompras,
    private readonly reloj: Reloj = relojDelSistema,
  ) {}

  private async traer(id: string): Promise<OrdenConRelaciones> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) throw new ErrorNoEncontrado(`No existe la orden de compra con id ${id}`);
    return orden;
  }

  /** Valida que existan el proveedor y todos los materiales del detalle. */
  private async validarReferencias(proveedorId: string, renglones: RenglonPedido[]) {
    if (!(await this.proveedores.existe(proveedorId))) {
      throw new ErrorNoEncontrado(`No existe el proveedor con id ${proveedorId}`);
    }
    // Uno por uno y en orden: el dominio revisa cada renglón antes de pasar al
    // siguiente, y el pañol dice si el material se puede seguir comprando. No
    // tiene sentido comprar algo que se sacó de circulación.
    for (const materialId of materialesDeLosRenglones(renglones)) {
      await this.panol.verificarEnUso(materialId);
    }
  }

  private aDatosRenglones(renglones: RenglonPedido[]): DatosRenglon[] {
    return renglones.map((r) => ({
      materialId: r.materialId ?? null,
      cantidad: aDecimal(r.cantidad),
      precioUnitario: r.precioUnitario === undefined ? null : aDecimal(r.precioUnitario),
      notas: r.notas ?? null,
      // Lo del equipo viaja junto: recien al recibir se crea la ficha.
      descripcionEquipo: r.descripcionEquipo?.trim() || null,
      clasificacion: r.descripcionEquipo ? (r.clasificacion ?? 'EQUIPO') : null,
      equipoTipoId: r.equipoTipoId ?? null,
      equipoMarcaId: r.equipoMarcaId ?? null,
      equipoModeloId: r.equipoModeloId ?? null,
    }));
  }

  async crear(datos: DatosAltaOrden, creadoPorId: string | null): Promise<OrdenConRelaciones> {
    await this.validarReferencias(datos.proveedorId, datos.renglones);
    return this.repo.crear({
      proveedorId: datos.proveedorId,
      observaciones: datos.observaciones ?? null,
      creadoPorId,
      renglones: this.aDatosRenglones(datos.renglones),
    });
  }

  async listar(
    filtro: FiltroOrdenes,
    skip: number,
    limite: number,
  ): Promise<{ items: OrdenConRelaciones[]; total: number }> {
    const [items, total] = await Promise.all([
      this.repo.buscarConFiltros(filtro, skip, limite),
      this.repo.contar(filtro),
    ]);
    return { items, total };
  }

  obtener(id: string): Promise<OrdenConRelaciones> {
    return this.traer(id);
  }

  async actualizar(id: string, datos: DatosCambioOrden): Promise<OrdenConRelaciones> {
    const orden = await this.traer(id);
    validarEditable(orden);
    validarQueQuedanRenglones(datos.renglones);

    await this.validarReferencias(datos.proveedorId ?? orden.proveedorId, datos.renglones ?? []);

    return this.repo.actualizar(id, {
      proveedorId: datos.proveedorId,
      observaciones: datos.observaciones,
      renglones: datos.renglones ? this.aDatosRenglones(datos.renglones) : undefined,
    });
  }

  /** Marca la orden como emitida (ya se le mandó al proveedor). */
  async emitir(id: string): Promise<OrdenConRelaciones> {
    const orden = await this.traer(id);
    validarTransicion(orden, 'EMITIDA');
    validarQueSePuedeEmitir(orden.renglones);
    return this.repo.cambiarEstado(id, 'EMITIDA', { emitidaEn: this.reloj.ahora() });
  }

  /**
   * Recibe la mercadería: genera un movimiento de ENTRADA por renglón y suma
   * el stock. Es la operación que conecta compras con inventario.
   */
  async recibir(
    id: string,
    datos: DatosRecibir,
    recibidaPorId: string | null,
  ): Promise<OrdenConRelaciones> {
    const orden = await this.traer(id);
    validarTransicion(orden, 'RECIBIDA');
    const comprobante = comprobanteDeRecepcion(orden.numero, datos.remito, datos.factura);

    const fechaRecepcion = datos.fechaRecepcion ?? this.reloj.ahora();

    // Recibir genera un movimiento de ENTRADA por renglón con esta fecha, así
    // que le corresponde la misma regla que a un movimiento cargado a mano: no
    // puede quedar por detrás del último ajuste del material. Se comprueban
    // TODOS antes de tocar nada, para no dejar media orden recibida.
    for (const renglon of orden.renglones ?? []) {
      // Los renglones de equipo no mueven stock, asi que no hay ajuste contra
      // el que comparar: esta regla es solo de los materiales.
      if (!renglon.materialId) continue;
      await this.panol.verificarFechaContraAjustes(
        renglon.materialId,
        fechaRecepcion,
        renglon.material?.nombre,
      );
    }

    return this.repo.recibir({
      id,
      fechaRecepcion,
      recibidaPorId,
      referencia: comprobante.referencia,
      remito: comprobante.remito,
      factura: comprobante.factura,
      notas: datos.notas ?? null,
    });
  }

  async anular(id: string): Promise<OrdenConRelaciones> {
    const orden = await this.traer(id);
    validarTransicion(orden, 'ANULADA');
    return this.repo.cambiarEstado(id, 'ANULADA');
  }

  async eliminar(id: string): Promise<void> {
    validarEliminable(await this.traer(id));
    await this.repo.eliminar(id);
  }
}
