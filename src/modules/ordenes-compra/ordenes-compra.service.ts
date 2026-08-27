import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoOrdenCompra, Usuario } from '@prisma/client';
import { RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { aDecimal } from '../../common/dominio/decimal';
import { finDelDia, inicioDelDia } from '../../common/dominio/fechas';
import { MaterialesService } from '../materiales/materiales.service';
import { ProveedoresService } from '../proveedores/proveedores.service';
import { ActualizarOrdenDto } from './dto/actualizar-orden.dto';
import { CrearOrdenDto, RenglonOrdenDto } from './dto/crear-orden.dto';
import { ListarOrdenesDto } from './dto/listar-ordenes.dto';
import { OrdenRespuestaDto } from './dto/orden-respuesta.dto';
import { RecibirOrdenDto } from './dto/recibir-orden.dto';
import { FiltroOrdenes, OrdenesCompraRepository } from './ordenes-compra.repository';

/**
 * Transiciones de estado permitidas.
 * BORRADOR → EMITIDA → RECIBIDA. Desde borrador o emitida se puede anular;
 * una orden RECIBIDA ya movió stock, así que es terminal.
 */
const TRANSICIONES: Record<EstadoOrdenCompra, EstadoOrdenCompra[]> = {
  [EstadoOrdenCompra.BORRADOR]: [EstadoOrdenCompra.EMITIDA, EstadoOrdenCompra.ANULADA],
  [EstadoOrdenCompra.EMITIDA]: [EstadoOrdenCompra.RECIBIDA, EstadoOrdenCompra.ANULADA],
  [EstadoOrdenCompra.RECIBIDA]: [],
  [EstadoOrdenCompra.ANULADA]: [],
};

@Injectable()
export class OrdenesCompraService {
  constructor(
    private readonly repo: OrdenesCompraRepository,
    private readonly proveedores: ProveedoresService,
    private readonly materiales: MaterialesService,
  ) {}

  /** Valida que existan el proveedor y todos los materiales del detalle. */
  private async validarReferencias(
    proveedorId: string,
    renglones: RenglonOrdenDto[],
  ): Promise<void> {
    await this.proveedores.obtener(proveedorId); // 404 con mensaje claro

    // Un mismo material dos veces en la misma orden confunde al proveedor y
    // duplica el movimiento de stock: mejor un solo renglón con la suma.
    const vistos = new Set<string>();
    for (const renglon of renglones) {
      if (vistos.has(renglon.materialId)) {
        throw new BadRequestException(
          'La orden tiene el mismo material en más de un renglón. Unificalos en uno solo.',
        );
      }
      vistos.add(renglon.materialId);
      await this.materiales.obtener(renglon.materialId);
    }
  }

  private aDatosRenglones(renglones: RenglonOrdenDto[]) {
    return renglones.map((r) => ({
      materialId: r.materialId,
      cantidad: aDecimal(r.cantidad),
      precioUnitario: r.precioUnitario === undefined ? null : aDecimal(r.precioUnitario),
      notas: r.notas ?? null,
    }));
  }

  async crear(dto: CrearOrdenDto, usuarioActual?: Usuario): Promise<OrdenRespuestaDto> {
    await this.validarReferencias(dto.proveedorId, dto.renglones);

    const creada = await this.repo.crear({
      proveedorId: dto.proveedorId,
      fechaEntregaEstimada: dto.fechaEntregaEstimada ? new Date(dto.fechaEntregaEstimada) : null,
      observaciones: dto.observaciones ?? null,
      creadoPorId: usuarioActual?.id ?? null,
      renglones: this.aDatosRenglones(dto.renglones),
    });

    return OrdenRespuestaDto.desde(creada);
  }

  async listar(query: ListarOrdenesDto): Promise<RespuestaPaginada<OrdenRespuestaDto>> {
    const filtro: FiltroOrdenes = {
      buscar: query.buscar,
      estado: query.estado,
      proveedorId: query.proveedorId,
      fechaDesde: query.fechaDesde ? inicioDelDia(query.fechaDesde) : undefined,
      fechaHasta: query.fechaHasta ? finDelDia(query.fechaHasta) : undefined,
    };

    const [items, total] = await Promise.all([
      this.repo.buscarConFiltros(filtro, query.skip, query.limite),
      this.repo.contar(filtro),
    ]);

    return {
      datos: items.map(OrdenRespuestaDto.desde),
      total,
      pagina: query.pagina,
      limite: query.limite,
    };
  }

  async obtener(id: string): Promise<OrdenRespuestaDto> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) {
      throw new NotFoundException(`No existe la orden de compra con id ${id}`);
    }
    return OrdenRespuestaDto.desde(orden);
  }

  async actualizar(id: string, dto: ActualizarOrdenDto): Promise<OrdenRespuestaDto> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) {
      throw new NotFoundException(`No existe la orden de compra con id ${id}`);
    }
    if (orden.estado !== EstadoOrdenCompra.BORRADOR) {
      throw new BadRequestException(
        `La orden ${orden.numero} está ${orden.estado} y ya no se puede editar. ` +
          'Solo se editan las órdenes en BORRADOR.',
      );
    }

    if (dto.renglones && dto.renglones.length === 0) {
      throw new BadRequestException('La orden debe tener al menos un renglón.');
    }

    await this.validarReferencias(dto.proveedorId ?? orden.proveedorId, dto.renglones ?? []);

    const actualizada = await this.repo.actualizar(id, {
      proveedorId: dto.proveedorId,
      fechaEntregaEstimada: dto.fechaEntregaEstimada
        ? new Date(dto.fechaEntregaEstimada)
        : undefined,
      observaciones: dto.observaciones,
      renglones: dto.renglones ? this.aDatosRenglones(dto.renglones) : undefined,
    });

    return OrdenRespuestaDto.desde(actualizada);
  }

  /** Valida la transición y da un mensaje que explica por qué no se puede. */
  private validarTransicion(
    numero: string,
    actual: EstadoOrdenCompra,
    destino: EstadoOrdenCompra,
  ): void {
    if (!TRANSICIONES[actual].includes(destino)) {
      throw new BadRequestException(
        `La orden ${numero} está ${actual} y no puede pasar a ${destino}.`,
      );
    }
  }

  /** Marca la orden como emitida (ya se le mandó al proveedor). */
  async emitir(id: string): Promise<OrdenRespuestaDto> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) {
      throw new NotFoundException(`No existe la orden de compra con id ${id}`);
    }
    this.validarTransicion(orden.numero, orden.estado, EstadoOrdenCompra.EMITIDA);

    if (!orden.renglones?.length) {
      throw new BadRequestException('No se puede emitir una orden sin renglones.');
    }

    const emitida = await this.repo.cambiarEstado(id, EstadoOrdenCompra.EMITIDA, {
      emitidaEn: new Date(),
    });
    return OrdenRespuestaDto.desde(emitida);
  }

  /**
   * Recibe la mercadería: genera un movimiento de ENTRADA por renglón y suma
   * el stock. Es la operación que conecta compras con inventario.
   */
  async recibir(
    id: string,
    dto: RecibirOrdenDto,
    usuarioActual?: Usuario,
  ): Promise<OrdenRespuestaDto> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) {
      throw new NotFoundException(`No existe la orden de compra con id ${id}`);
    }
    this.validarTransicion(orden.numero, orden.estado, EstadoOrdenCompra.RECIBIDA);

    // La referencia queda en cada movimiento: desde el stock se llega a la orden.
    const referencia = dto.remito ? `${orden.numero} · Remito ${dto.remito}` : orden.numero;

    const recibida = await this.repo.recibir({
      id,
      fechaRecepcion: dto.fechaRecepcion ? new Date(dto.fechaRecepcion) : new Date(),
      recibidaPorId: usuarioActual?.id ?? null,
      referencia,
      notas: dto.notas ?? null,
    });

    return OrdenRespuestaDto.desde(recibida);
  }

  async anular(id: string): Promise<OrdenRespuestaDto> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) {
      throw new NotFoundException(`No existe la orden de compra con id ${id}`);
    }
    this.validarTransicion(orden.numero, orden.estado, EstadoOrdenCompra.ANULADA);

    const anulada = await this.repo.cambiarEstado(id, EstadoOrdenCompra.ANULADA);
    return OrdenRespuestaDto.desde(anulada);
  }

  async eliminar(id: string): Promise<void> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) {
      throw new NotFoundException(`No existe la orden de compra con id ${id}`);
    }
    if (orden.estado !== EstadoOrdenCompra.BORRADOR) {
      throw new BadRequestException(
        `Solo se pueden eliminar órdenes en BORRADOR. La orden ${orden.numero} está ${orden.estado}; ` +
          'si ya no corresponde, anulala para conservar el registro.',
      );
    }
    await this.repo.eliminar(id);
  }
}
