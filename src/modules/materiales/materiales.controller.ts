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
