import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MotivoMovimiento, RolUsuario, TipoMovimiento, Usuario } from '@prisma/client';
import { RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { Decimal, aDecimal, aNumero } from '../../common/dominio/decimal';
import { finDelDia, inicioDelDia } from '../../common/dominio/fechas';
import { ActualizarMovimientoDto } from './dto/actualizar-movimiento.dto';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';
import { EdicionRespuestaDto } from './dto/edicion-respuesta.dto';
import { FiltrarMovimientosDto } from './dto/filtrar-movimientos.dto';
import { MovimientoRespuestaDto } from './dto/movimiento-respuesta.dto';
import {
  FiltroMovimientos,
  REPOSITORIO_MOVIMIENTOS,
  RepositorioMovimientos,
} from './movimientos-stock.puerto';
import { verificarNoQuedaDetrasDeUnAjuste } from './regla-fecha-ajuste';

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
  constructor(@Inject(REPOSITORIO_MOVIMIENTOS) private readonly repo: RepositorioMovimientos) {}

  /** Invariante compartida por alta y edición: el motivo debe encajar con el tipo. */
  private validarTipoYMotivo(tipo: TipoMovimiento, motivo: MotivoMovimiento): void {
    const motivosValidos = MOTIVOS_POR_TIPO[tipo];
    if (!motivosValidos.includes(motivo)) {
      throw new BadRequestException(
        `El motivo ${motivo} no corresponde a un movimiento de tipo ${tipo}. ` +
          `Motivos válidos: ${motivosValidos.join(', ')}.`,
      );
    }
  }

  /** ENTRADA/SALIDA deben mover una cantidad > 0 (no tendría sentido 0). */
  private validarCantidad(tipo: TipoMovimiento, cantidad: Decimal): void {
    if (tipo !== TipoMovimiento.AJUSTE && cantidad.lessThanOrEqualTo(0)) {
      throw new BadRequestException('La cantidad debe ser mayor a 0 para ENTRADA y SALIDA.');
    }
  }

  /**
   * Comprueba que la fecha no caiga por detras del ultimo ajuste del material.
   *
   * Es publico porque la recepcion de una orden de compra genera movimientos de
   * ENTRADA por su cuenta, con la fecha de recepcion que carga el usuario: es la
   * misma puerta al mismo problema, y la regla tiene que valer en las dos.
   */
  async verificarFechaContraAjustes(
    materialId: string,
    fecha: Date,
    opciones: { excluirMovimientoId?: string; nombreDelMaterial?: string } = {},
  ): Promise<void> {
    const ultimoAjuste = await this.repo.fechaDelUltimoAjuste(
      materialId,
      opciones.excluirMovimientoId,
    );
    verificarNoQuedaDetrasDeUnAjuste(fecha, ultimoAjuste, opciones.nombreDelMaterial);
  }

  async crear(dto: CrearMovimientoDto, usuarioIdActual?: string): Promise<MovimientoRespuestaDto> {
    const cantidad = aDecimal(dto.cantidad);

    this.validarCantidad(dto.tipo, cantidad);
    this.validarTipoYMotivo(dto.tipo, dto.motivo);

    // Vale tambien para un AJUSTE nuevo: retrofechado por detras de otro ajuste
    // arrastra el mismo desacuerdo entre el stock guardado y el recalculo.
    const fechaDelMovimiento = dto.fecha ? new Date(dto.fecha) : new Date();
    await this.verificarFechaContraAjustes(dto.materialId, fechaDelMovimiento);

    // Regla de negocio: cómo cambia el stock según el tipo de movimiento.
    // Toda la aritmética es Decimal para no arrastrar error de punto flotante.
    const calcularNuevoStock = (stockActual: Decimal): Decimal => {
      switch (dto.tipo) {
        case TipoMovimiento.ENTRADA:
          return stockActual.plus(cantidad);
        case TipoMovimiento.SALIDA: {
          const resultado = stockActual.minus(cantidad);
          if (resultado.isNegative()) {
            throw new BadRequestException(
              `Stock insuficiente: hay ${stockActual.toString()} y se intentan retirar ` +
                `${cantidad.toString()}. Usá un movimiento de tipo AJUSTE si necesitás corregir el stock.`,
            );
          }
          return resultado;
        }
        case TipoMovimiento.AJUSTE:
          // El AJUSTE fija el stock al valor absoluto de `cantidad` (>= 0 por el DTO).
          return cantidad;
        default:
          throw new BadRequestException('Tipo de movimiento no soportado.');
      }
    };

    const movimiento = await this.repo.crearConActualizacionDeStock(
      {
        materialId: dto.materialId,
        tipo: dto.tipo,
        motivo: dto.motivo,
        cantidad,
        fecha: dto.fecha ? fechaDelMovimiento : undefined,
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
    // `fechaDesde`/`fechaHasta` son inclusivas y pueden venir como YYYY-MM-DD.
    // Se expanden a [00:00:00.000, 23:59:59.999] para no perder los movimientos
    // cargados durante el propio día del extremo del rango.
    const filtro: FiltroMovimientos = {
      materialId: filtros.materialId,
      tipo: filtros.tipo,
      motivo: filtros.motivo,
      fechaDesde: filtros.fechaDesde ? inicioDelDia(filtros.fechaDesde) : undefined,
      fechaHasta: filtros.fechaHasta ? finDelDia(filtros.fechaHasta) : undefined,
    };

    const [items, total] = await Promise.all([
      this.repo.buscarConFiltros(filtro, filtros.skip, filtros.limite),
      this.repo.contar(filtro),
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

  /**
   * Edita un movimiento (corrección). Solo lo puede hacer quien lo creó o un ADMIN.
   * Exige un motivo de edición, recalcula el stock del material y deja auditoría.
   */
  async editar(
    id: string,
    dto: ActualizarMovimientoDto,
    usuarioActual?: Usuario,
  ): Promise<MovimientoRespuestaDto> {
    const actual = await this.repo.buscarPorId(id);
    if (!actual) {
      throw new NotFoundException(`No existe el movimiento con id ${id}`);
    }

    // Permiso: solo el creador o un admin (si hay sesión; en dev sin auth se permite).
    if (usuarioActual) {
      const esCreador = actual.usuarioId === usuarioActual.id;
      const esAdmin = usuarioActual.rol === RolUsuario.ADMIN;
      if (!esCreador && !esAdmin) {
        throw new ForbiddenException(
          'Solo quien registró el movimiento (o un admin) puede editarlo.',
        );
      }
    }

    // Valores nuevos = lo enviado sobre lo actual.
    const tipo = dto.tipo ?? actual.tipo;
    const motivo = dto.motivo ?? actual.motivo;
    const cantidad = aDecimal(dto.cantidad ?? actual.cantidad);
    const fecha = dto.fecha ? new Date(dto.fecha) : actual.fecha;
    const proveedorId = dto.proveedorId !== undefined ? dto.proveedorId : actual.proveedorId;
    const referenciaTrabajo =
      dto.referenciaTrabajo !== undefined ? dto.referenciaTrabajo : actual.referenciaTrabajo;
    const notas = dto.notas !== undefined ? dto.notas : actual.notas;

    // Validaciones de negocio (mismas reglas que al crear).
    this.validarCantidad(tipo, cantidad);
    this.validarTipoYMotivo(tipo, motivo);

    // El movimiento no se compara contra si mismo: si no, ninguna edicion de un
    // ajuste seria posible. Una edicion que lo retrofechara por detras de OTRO
    // ajuste movería el stock sola, que es justo la sorpresa que se evita.
    await this.verificarFechaContraAjustes(actual.materialId, fecha, {
      excluirMovimientoId: id,
    });

    // Snapshot antes/después (valores serializables para la auditoría).
    const antes = {
      tipo: actual.tipo,
      motivo: actual.motivo,
      cantidad: aNumero(actual.cantidad),
      fecha: actual.fecha.toISOString(),
      proveedorId: actual.proveedorId,
      referenciaTrabajo: actual.referenciaTrabajo,
      notas: actual.notas,
    };
    const despues = {
      tipo,
      motivo,
      cantidad: aNumero(cantidad),
      fecha: fecha.toISOString(),
      proveedorId,
      referenciaTrabajo,
      notas,
    };

    const actualizado = await this.repo.editarConAuditoria({
      id,
      materialId: actual.materialId,
      datos: { tipo, motivo, cantidad, fecha, proveedorId, referenciaTrabajo, notas },
      edicion: {
        usuarioId: usuarioActual?.id ?? null,
        motivo: dto.motivoEdicion,
        cambios: { antes, despues },
      },
      // Misma invariante que en el alta: el historial no puede dejar stock negativo.
      // Si falla, la transacción se revierte entera.
      validarStock: (stockRecalculado) => {
        if (stockRecalculado.isNegative()) {
          throw new BadRequestException(
            `Esta edición dejaría el stock del material en ${stockRecalculado.toString()}. ` +
              `Revisá el historial de movimientos antes de corregir.`,
          );
        }
      },
    });

    return MovimientoRespuestaDto.desde(actualizado);
  }

  async listarEdiciones(id: string): Promise<EdicionRespuestaDto[]> {
    await this.obtener(id); // valida que el movimiento exista
    const ediciones = await this.repo.listarEdiciones(id);
    return ediciones.map(EdicionRespuestaDto.desde);
  }
}
