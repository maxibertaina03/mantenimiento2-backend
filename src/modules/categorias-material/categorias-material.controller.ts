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
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto';
import { CategoriasMaterialService } from './categorias-material.service';
import { Permisos } from '../../common/auth/decorators/permisos.decorator';
import { PERMISOS } from '../../common/auth/permisos';

@ApiTags('Categorías de material')
@Controller('categorias-material')
export class CategoriasMaterialController {
  constructor(private readonly service: CategoriasMaterialService) {}

  @Permisos(PERMISOS.CATALOGOS_EDITAR)
  @Post()
  @ApiOperation({ summary: 'Crear una categoría de material' })
  crear(@Body() dto: CrearCategoriaDto) {
    return this.service.crear(dto);
  }

  @Permisos(PERMISOS.CATALOGOS_VER)
  @Get()
  @ApiOperation({ summary: 'Listar categorías de material' })
  listar() {
    return this.service.listar();
  }

  @Permisos(PERMISOS.CATALOGOS_VER)
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una categoría por id' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Permisos(PERMISOS.CATALOGOS_EDITAR)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una categoría' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarCategoriaDto) {
    return this.service.actualizar(id, dto);
  }

  @Permisos(PERMISOS.CATALOGOS_EDITAR)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una categoría (si no tiene materiales asociados)' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(id);
  }
}
