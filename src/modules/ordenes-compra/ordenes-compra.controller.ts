import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Usuario } from '@prisma/client';
import { UsuarioActual } from '../../common/auth/decorators/usuario-actual.decorator';
import { ActualizarOrdenDto } from './dto/actualizar-orden.dto';
import { CrearOrdenDto } from './dto/crear-orden.dto';
import { ListarOrdenesDto } from './dto/listar-ordenes.dto';
import { RecibirOrdenDto } from './dto/recibir-orden.dto';
import { OrdenesCompraService } from './ordenes-compra.service';

@ApiTags('Órdenes de compra')
@ApiBearerAuth()
@Controller('ordenes-compra')
export class OrdenesCompraController {
  constructor(private readonly service: OrdenesCompraService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una orden de compra (queda en BORRADOR con número asignado)' })
  crear(@Body() dto: CrearOrdenDto, @UsuarioActual() usuario?: Usuario) {
    return this.service.crear(dto, usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Listar órdenes con filtros (estado, proveedor, rango de fechas)' })
  listar(@Query() query: ListarOrdenesDto) {
    return this.service.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una orden con su detalle completo' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar una orden (solo en BORRADOR)' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarOrdenDto) {
    return this.service.actualizar(id, dto);
  }

  @Patch(':id/emitir')
  @ApiOperation({ summary: 'Marcar la orden como emitida (enviada al proveedor)' })
  emitir(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.emitir(id);
  }

  @Patch(':id/recibir')
  @ApiOperation({
    summary: 'Recibir la mercadería: genera un movimiento de ENTRADA por renglón y suma el stock',
  })
  recibir(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecibirOrdenDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    return this.service.recibir(id, dto, usuario);
  }

  @Patch(':id/anular')
  @ApiOperation({ summary: 'Anular la orden (conserva el registro)' })
  anular(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.anular(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una orden en BORRADOR' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(id);
  }
}
