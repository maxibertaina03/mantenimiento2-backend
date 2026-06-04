import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MotivoMovimiento, Prisma, TipoMovimiento } from '@prisma/client';
import { RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';
import { FiltrarMovimientosDto } from './dto/filtrar-movimientos.dto';
import { MovimientoRespuestaDto } from './dto/movimiento-respuesta.dto';
import { MovimientosStockRepository } from './movimientos-stock.repository';

/**
 * Motivos válidos según el tipo de movimiento.
 * - ENTRADA suma stock: COMPRA u OTRO.
 * - SALIDA resta stock: TRABAJO, DEVOLUCION (al proveedor) u OTRO.
 * - AJUSTE fija el stock: AJUSTE u OTRO.
 */
export const MOTIVOS_POR_TIPO: Record<TipoMovimiento, MotivoMovimiento[]> = {
  [TipoMovimiento.ENTRADA]: [MotivoMovimiento.COMPRA, MotivoMovimiento.OTRO],
  [TipoMovimiento.SALIDA]: [
    MotivoMovimiento.TRABAJO,
    MotivoMovimiento.DEVOLUCION,
    MotivoMovimiento.OTRO,
  ],
  [TipoMovimiento.AJUSTE]: [MotivoMovimiento.AJUSTE, MotivoMovimiento.OTRO],
};

@Injectable()
export class MovimientosStockService {
  constructor(private readonly repo: MovimientosStockRepository) {}

  async crear(dto: CrearMovimientoDto, usuarioIdActual?: string): Promise<MovimientoRespuestaDto> {
    // Regla: ENTRADA/SALIDA deben mover una cantidad > 0 (no tendría sentido 0).
    if (dto.tipo !== TipoMovimiento.AJUSTE && dto.cantidad <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a 0 para ENTRADA y SALIDA.');
    }

    // Regla: el motivo tiene que ser coherente con el tipo de movimiento.
    const motivosValidos = MOTIVOS_POR_TIPO[dto.tipo];
    if (!motivosValidos.includes(dto.motivo)) {
      throw new BadRequestException(
        `El motivo ${dto.motivo} no corresponde a un movimiento de tipo ${dto.tipo}. ` +
          `Motivos válidos: ${motivosValidos.join(', ')}.`,
      );
    }

    // Regla de negocio: cómo cambia el stock según el tipo de movimiento.
    const calcularNuevoStock = (stockActual: number): number => {
      switch (dto.tipo) {
        case TipoMovimiento.ENTRADA:
          return stockActual + dto.cantidad;
        case TipoMovimiento.SALIDA: {
          const resultado = stockActual - dto.cantidad;
          if (resultado < 0) {
            throw new BadRequestException(
              `Stock insuficiente: hay ${stockActual} y se intentan retirar ${dto.cantidad}. ` +
                `Usá un movimiento de tipo AJUSTE si necesitás corregir el stock.`,
            );
          }
          return resultado;
        }
        case TipoMovimiento.AJUSTE:
          // El AJUSTE fija el stock al valor absoluto de `cantidad` (>= 0 por validación del DTO).
          return dto.cantidad;
        default:
          throw new BadRequestException('Tipo de movimiento no soportado.');
      }
    };

    const movimiento = await this.repo.crearConActualizacionDeStock(
      {
        materialId: dto.materialId,
        tipo: dto.tipo,
        motivo: dto.motivo,
        cantidad: dto.cantidad,
        fecha: dto.fecha ? new Date(dto.fecha) : undefined,
        proveedorId: dto.proveedorId,
        usuarioId: usuarioIdActual ?? dto.usuarioId,
        referenciaTrabajo: dto.referenciaTrabajo,
        notas: dto.notas,
      },
      calcularNuevoStock,
    );

    return MovimientoRespuestaDto.desde(movimiento);
  }

  async listar(filtros: FiltrarMovimientosDto): Promise<RespuestaPaginada<MovimientoRespuestaDto>> {
    const where: Prisma.MovimientoStockWhereInput = {
      ...(filtros.materialId ? { materialId: filtros.materialId } : {}),
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      ...(filtros.motivo ? { motivo: filtros.motivo } : {}),
      ...(filtros.fechaDesde || filtros.fechaHasta
        ? {
            fecha: {
              ...(filtros.fechaDesde ? { gte: new Date(filtros.fechaDesde) } : {}),
              ...(filtros.fechaHasta ? { lte: new Date(filtros.fechaHasta) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.repo.buscarConFiltros(where, filtros.skip, filtros.limite),
      this.repo.contar(where),
    ]);

    return {
      datos: items.map(MovimientoRespuestaDto.desde),
      total,
      pagina: filtros.pagina,
      limite: filtros.limite,
    };
  }

  async obtener(id: string): Promise<MovimientoRespuestaDto> {
    const movimiento = await this.repo.buscarPorId(id);
    if (!movimiento) {
      throw new NotFoundException(`No existe el movimiento con id ${id}`);
    }
    return MovimientoRespuestaDto.desde(movimiento);
  }
}
