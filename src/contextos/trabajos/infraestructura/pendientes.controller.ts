import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario, type Usuario } from '@prisma/client';
import { Permisos } from '../../../common/auth/decorators/permisos.decorator';
import { UsuarioActual } from '../../../common/auth/decorators/usuario-actual.decorator';
import { PERMISOS } from '../../../common/auth/permisos';
import { FiltroErroresDominio } from '../../../common/dominio/filtro-errores-dominio';
import { GestionarPendientes } from '../aplicacion/gestionar-pendientes';
import { CONSULTA_USUARIOS, ConsultaUsuarios } from '../puertos/consulta-usuarios';
import {
  CrearPendienteDto,
  EditarPendienteDto,
  ListarPendientesDto,
  MarcarHechoDto,
} from './pendientes.dto';

/** Sin usuario (AUTH_DISABLED, en local) se trata como administrador. */
const esAdministrador = (usuario?: Usuario) => !usuario || usuario.rol === RolUsuario.ADMIN;

/**
 * El anotador de pendientes de mantenimiento: lo que quedó por hacer
 * («comprar tal cosa», «mandar a reparar tal otra»), a la vista de todos.
 */
@ApiTags('Pendientes')
@ApiBearerAuth()
@UseFilters(FiltroErroresDominio)
@Controller('pendientes')
export class PendientesController {
  constructor(
    private readonly gestionar: GestionarPendientes,
    @Inject(CONSULTA_USUARIOS) private readonly usuarios: ConsultaUsuarios,
  ) {}

  /**
   * A quién se le puede dar un pendiente. El anotador lo usa todo
   * mantenimiento, que no puede listar el padrón ni ve las órdenes de trabajo:
   * por eso tiene su propia lista, con id y nombre y nada más. Va antes que
   * las rutas con `:id`.
   */
  @Permisos(PERMISOS.PENDIENTES_VER)
  @Get('personas')
  @ApiOperation({ summary: 'A quién se le puede dar un pendiente' })
  async personas() {
    return (await this.usuarios.listarAsignables()).map(({ id, nombre }) => ({ id, nombre }));
  }

  @Permisos(PERMISOS.PENDIENTES_VER)
  @Get()
  @ApiOperation({
    summary: 'Los pendientes abiertos (urgentes primero) o los hechos en los últimos 60 días',
  })
  listar(@Query() query: ListarPendientesDto) {
    return this.gestionar.listar(query.estado ?? 'abiertos');
  }

  @Permisos(PERMISOS.PENDIENTES_EDITAR)
  @Post()
  @ApiOperation({ summary: 'Anotar un pendiente' })
  crear(@Body() dto: CrearPendienteDto, @UsuarioActual() usuario?: Usuario) {
    return this.gestionar.crear(dto, usuario?.id ?? null);
  }

  @Permisos(PERMISOS.PENDIENTES_EDITAR)
  @Patch(':id')
  @ApiOperation({ summary: 'Corregir el texto, marcarlo urgente, cambiar a quién le toca' })
  editar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EditarPendienteDto) {
    return this.gestionar.editar(id, dto);
  }

  @Permisos(PERMISOS.PENDIENTES_EDITAR)
  @Post(':id/hecho')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Darlo por hecho (si le toca a alguien, solo esa persona o un administrador)',
  })
  hecho(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarcarHechoDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    return this.gestionar.marcarHecho(
      id,
      usuario?.id ?? null,
      esAdministrador(usuario),
      dto.ordenTrabajoId ?? null,
    );
  }

  @Permisos(PERMISOS.PENDIENTES_EDITAR)
  @Post(':id/reabrir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Volverlo a pendiente' })
  reabrir(@Param('id', ParseUUIDPipe) id: string) {
    return this.gestionar.reabrir(id);
  }

  @Permisos(PERMISOS.PENDIENTES_EDITAR)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borrarlo (solo quien lo anotó, o un administrador)' })
  borrar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario?: Usuario) {
    return this.gestionar.borrar(id, usuario?.id ?? null, esAdministrador(usuario));
  }
}
