import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Usuario } from '@prisma/client';
import { UsuarioActual } from '../../common/auth/decorators/usuario-actual.decorator';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';
import { FiltrarMovimientosDto } from './dto/filtrar-movimientos.dto';
import { MovimientosStockService } from './movimientos-stock.service';

@ApiTags('Movimientos de stock')
@ApiBearerAuth()
@Controller('movimientos')
export class MovimientosStockController {
  constructor(private readonly service: MovimientosStockService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un movimiento (actualiza el stock del material en transacción)',
  })
  crear(@Body() dto: CrearMovimientoDto, @UsuarioActual() usuario?: Usuario) {
    // Quién registró el movimiento: el usuario autenticado (si hay), si no el del DTO.
    return this.service.crear(dto, usuario?.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar movimientos con filtros (material, tipo, motivo, rango de fechas)',
  })
  listar(@Query() filtros: FiltrarMovimientosDto) {
    return this.service.listar(filtros);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un movimiento por id' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }
}
