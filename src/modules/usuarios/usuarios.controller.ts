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
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import type { Usuario } from '@prisma/client';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { UsuarioActual } from '../../common/auth/decorators/usuario-actual.decorator';
import { PaginacionDto } from '../../common/dto/paginacion.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { UsuarioRespuestaDto } from './dto/usuario-respuesta.dto';
import { UsuariosService } from './usuarios.service';

/**
 * Los endpoints van marcados uno por uno y NO a nivel de clase, porque `me`
 * tiene que quedar abierto: cualquier usuario autenticado necesita saber quién
 * es y qué rol tiene.
 *
 * Antes estos endpoints estaban SIN restricción: cualquier operario podía
 * cambiarle el rol a cualquiera, incluido hacerse administrador a sí mismo.
 */
@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly service: UsuariosService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear un usuario' })
  @Roles(RolUsuario.ADMIN)
  crear(@Body() dto: CrearUsuarioDto) {
    return this.service.crear(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar usuarios (paginado)' })
  @Roles(RolUsuario.ADMIN)
  listar(@Query() paginacion: PaginacionDto) {
    return this.service.listar(paginacion);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario autenticado actual (o null si no hay sesión)' })
  yo(@UsuarioActual() usuario?: Usuario): UsuarioRespuestaDto | null {
    if (usuario) return UsuarioRespuestaDto.desde(usuario);

    // Con AUTH_DISABLED no hay sesión, así que esto devolvía null y el frontend
    // trataba a quien probara en local como si no fuera administrador: las
    // pantallas reservadas a admin quedaban escondidas y no había forma de
    // probarlas sin levantar Clerk.
    //
    // No abre nada: con AUTH_DISABLED la API ya está completamente abierta, y
    // el guard deja pasar todo antes de llegar acá. La condición es sobre el
    // valor exacto "true" para que un typo no lo active en producción.
    if (this.config.get<string>('AUTH_DISABLED') === 'true') {
      return {
        id: 'sin-sesion-local',
        nombre: 'Usuario local (sin login)',
        email: 'local@sin-acceso.local',
        rol: RolUsuario.ADMIN,
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      } as UsuarioRespuestaDto;
    }

    return null;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un usuario por id' })
  @Roles(RolUsuario.ADMIN)
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un usuario' })
  @Roles(RolUsuario.ADMIN)
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarUsuarioDto) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un usuario' })
  @Roles(RolUsuario.ADMIN)
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(id);
  }
}
