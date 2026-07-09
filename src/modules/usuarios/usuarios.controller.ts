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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Usuario } from '@prisma/client';
import { UsuarioActual } from '../../common/auth/decorators/usuario-actual.decorator';
import { PaginacionDto } from '../../common/dto/paginacion.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { UsuarioRespuestaDto } from './dto/usuario-respuesta.dto';
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

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario autenticado actual (o null si no hay sesión)' })
  yo(@UsuarioActual() usuario?: Usuario): UsuarioRespuestaDto | null {
    return usuario ? UsuarioRespuestaDto.desde(usuario) : null;
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
