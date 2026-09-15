import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Usuario } from '@prisma/client';
import { UsuarioActual } from '../../common/auth/decorators/usuario-actual.decorator';
import { ActualizarMovimientoDto } from './dto/actualizar-movimiento.dto';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';
import { FiltrarMovimientosDto } from './dto/filtrar-movimientos.dto';
import { MovimientosStockService } from './movimientos-stock.service';
import { Permisos } from '../../common/auth/decorators/permisos.decorator';
import { PERMISOS } from '../../common/auth/permisos';

@ApiTags('Movimientos de stock')
@ApiBearerAuth()
@Controller('movimientos')
export class MovimientosStockController {
  constructor(private readonly service: MovimientosStockService) {}

  @Permisos(PERMISOS.MOVIMIENTOS_CREAR)
  @Post()
  @ApiOperation({
    summary: 'Registrar un movimiento (actualiza el stock del material en transacción)',
  })
  crear(@Body() dto: CrearMovimientoDto, @UsuarioActual() usuario?: Usuario) {
    // Quién registró el movimiento: el usuario autenticado (si hay), si no el del DTO.
    return this.service.crear(dto, usuario?.id);
  }

  @Permisos(PERMISOS.MOVIMIENTOS_VER)
  @Get()
  @ApiOperation({
    summary: 'Listar movimientos con filtros (material, tipo, motivo, rango de fechas)',
  })
  listar(@Query() filtros: FiltrarMovimientosDto) {
    return this.service.listar(filtros);
  }

  @Permisos(PERMISOS.MOVIMIENTOS_VER)
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un movimiento por id' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Permisos(PERMISOS.MOVIMIENTOS_EDITAR)
  @Patch(':id')
  @ApiOperation({
    summary: 'Editar un movimiento (solo el creador o un admin; exige motivo, deja auditoría)',
  })
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarMovimientoDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    return this.service.editar(id, dto, usuario);
  }

  @Permisos(PERMISOS.MOVIMIENTOS_VER)
  @Get(':id/ediciones')
  @ApiOperation({ summary: 'Historial de ediciones (auditoría) de un movimiento' })
  ediciones(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listarEdiciones(id);
  }
}
