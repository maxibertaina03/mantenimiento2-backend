import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';
import { FiltrarMovimientosDto } from './dto/filtrar-movimientos.dto';
import { MovimientosStockService } from './movimientos-stock.service';

@ApiTags('Movimientos de stock')
@Controller('movimientos')
export class MovimientosStockController {
  constructor(private readonly service: MovimientosStockService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un movimiento (actualiza el stock del material en transacción)',
  })
  crear(@Body() dto: CrearMovimientoDto) {
    return this.service.crear(dto);
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
