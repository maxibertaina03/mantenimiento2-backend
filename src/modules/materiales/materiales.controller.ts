import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { AsignarUnidadMasivaDto } from './dto/asignar-unidad-masiva.dto';
import { CrearMaterialDto } from './dto/crear-material.dto';
import { ActualizarMaterialDto } from './dto/actualizar-material.dto';
import { ListarMaterialesDto } from './dto/listar-materiales.dto';
import { MaterialesService } from './materiales.service';

@ApiTags('Materiales')
@Controller('materiales')
export class MaterialesController {
  constructor(private readonly service: MaterialesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un material (stock inicial 0; se carga con movimientos)' })
  crear(@Body() dto: CrearMaterialDto) {
    return this.service.crear(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar materiales (paginado, con búsqueda por nombre)' })
  listar(@Query() query: ListarMaterialesDto) {
    return this.service.listar(query);
  }

  @Get('bajo-stock')
  @ApiOperation({ summary: 'Materiales con stock por debajo (o igual) del mínimo' })
  bajoStock() {
    return this.service.listarBajoStock();
  }

  // Declarada ANTES de @Get(':id') o la ruta la tomaría como un id.
  @Get('sin-unidad')
  @ApiOperation({ summary: 'Cuántos materiales todavía no tienen unidad cargada' })
  sinUnidad() {
    return this.service.contarSinUnidad();
  }

  @Post('asignar-unidad-masiva')
  @Roles(RolUsuario.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Asignar una unidad por defecto a los materiales que no tienen' })
  asignarUnidadMasiva(@Body() dto: AsignarUnidadMasivaDto) {
    return this.service.asignarUnidadMasiva(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un material por id' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Get(':id/historial')
  @ApiOperation({ summary: 'Obtener un material con su historial de movimientos' })
  historial(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtenerConHistorial(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un material (no modifica el stock)' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarMaterialDto) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un material (si no tiene movimientos)' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(id);
  }
}
