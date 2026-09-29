import { Inject, Injectable } from '@nestjs/common';
import type { Usuario } from '@prisma/client';
import { RespuestaPaginada } from '../../../../common/dto/paginacion.dto';
import { finDelDia, inicioDelDia } from '../../../../common/dominio/fechas';
import { RegistrarMovimientos } from '../../aplicacion/registrar-movimientos';
import {
  REPOSITORIO_MOVIMIENTOS,
  RepositorioMovimientos,
} from '../../puertos/repositorio-movimientos';
import { traducirErrores } from '../traducir-errores';
import { ActualizarMovimientoDto } from './dto/actualizar-movimiento.dto';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';
import { EdicionRespuestaDto } from './dto/edicion-respuesta.dto';
import { FiltrarMovimientosDto } from './dto/filtrar-movimientos.dto';
import { MovimientoRespuestaDto } from './dto/movimiento-respuesta.dto';

/** Las fechas llegan como texto: el caso de uso trabaja con fechas de verdad. */
function comoFecha(texto: string | undefined): Date | undefined {
  return texto ? new Date(texto) : undefined;
}

/**
 * La puerta de Nest a los movimientos del pañol.
 *
 * No decide nada: traduce el pedido al caso de uso, la respuesta a su DTO, y
 * los errores del dominio a las excepciones de siempre. Conserva el nombre y
 * las firmas del service de antes porque órdenes de compra y órdenes de
 * trabajo lo usan, y así no se enteraron de la mudanza.
 */
@Injectable()
export class MovimientosStockService {
  private readonly registrar: RegistrarMovimientos;

  constructor(@Inject(REPOSITORIO_MOVIMIENTOS) repo: RepositorioMovimientos) {
    this.registrar = new RegistrarMovimientos(repo);
  }

  /**
   * Comprueba que la fecha no caiga por detras del ultimo ajuste del material.
   *
   * Lo usa la recepcion de una orden de compra, que genera sus ENTRADAS con la
   * fecha que carga el usuario: la regla tiene que valer ahi tambien.
   */
  verificarFechaContraAjustes(
    materialId: string,
    fecha: Date,
    opciones: { excluirMovimientoId?: string; nombreDelMaterial?: string } = {},
  ): Promise<void> {
    return traducirErrores(() =>
      this.registrar.verificarFechaContraAjustes(materialId, fecha, opciones),
    );
  }

  crear(dto: CrearMovimientoDto, usuarioIdActual?: string): Promise<MovimientoRespuestaDto> {
    return traducirErrores(async () =>
      MovimientoRespuestaDto.desde(
        await this.registrar.crear({ ...dto, fecha: comoFecha(dto.fecha) }, usuarioIdActual),
      ),
    );
  }

  listar(filtros: FiltrarMovimientosDto): Promise<RespuestaPaginada<MovimientoRespuestaDto>> {
    return traducirErrores(async () => {
      // `fechaDesde`/`fechaHasta` son inclusivas y pueden venir como YYYY-MM-DD.
      // Se expanden a [00:00:00.000, 23:59:59.999] para no perder los movimientos
      // cargados durante el propio día del extremo del rango.
      const { items, total } = await this.registrar.listar(
        {
          materialId: filtros.materialId,
          tipo: filtros.tipo,
          motivo: filtros.motivo,
          fechaDesde: filtros.fechaDesde ? inicioDelDia(filtros.fechaDesde) : undefined,
          fechaHasta: filtros.fechaHasta ? finDelDia(filtros.fechaHasta) : undefined,
        },
        filtros.skip,
        filtros.limite,
      );
      return {
        datos: items.map(MovimientoRespuestaDto.desde),
        total,
        pagina: filtros.pagina,
        limite: filtros.limite,
      };
    });
  }

  obtener(id: string): Promise<MovimientoRespuestaDto> {
    return traducirErrores(async () =>
      MovimientoRespuestaDto.desde(await this.registrar.obtener(id)),
    );
  }

  /**
   * Edita un movimiento (corrección). Solo lo puede hacer quien lo creó o un ADMIN.
   * Exige un motivo de edición, recalcula el stock del material y deja auditoría.
   */
  editar(
    id: string,
    dto: ActualizarMovimientoDto,
    usuarioActual?: Usuario,
  ): Promise<MovimientoRespuestaDto> {
    return traducirErrores(async () =>
      MovimientoRespuestaDto.desde(
        await this.registrar.editar(
          id,
          { ...dto, fecha: comoFecha(dto.fecha) },
          usuarioActual ? { id: usuarioActual.id, rol: usuarioActual.rol } : undefined,
        ),
      ),
    );
  }

  listarEdiciones(id: string): Promise<EdicionRespuestaDto[]> {
    return traducirErrores(async () =>
      (await this.registrar.listarEdiciones(id)).map(EdicionRespuestaDto.desde),
    );
  }
}
