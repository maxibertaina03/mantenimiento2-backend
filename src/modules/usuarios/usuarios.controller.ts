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
import { PaginacionDto } from '../../common/dto/paginacion.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { UsuariosService } from './usuarios.service';

@ApiTags('Usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un usuario' })
  crear(@Body() dto: CrearUsuarioDto) {
    return this.service.crear(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar usuarios (paginado)' })
  listar(@Query() paginacion: PaginacionDto) {
    return this.service.listar(paginacion);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un usuario por id' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un usuario' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarUsuarioDto) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un usuario' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(id);
  }
}
