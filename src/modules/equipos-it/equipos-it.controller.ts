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
import { RolUsuario } from '@prisma/client';
import type { Usuario } from '@prisma/client';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { UsuarioActual } from '../../common/auth/decorators/usuario-actual.decorator';
import { ActualizarEquipoDto } from './dto/actualizar-equipo.dto';
import { AsignarEquipoDto } from './dto/asignar-equipo.dto';
import { CrearEquipoDto } from './dto/crear-equipo.dto';
import { ImportarEquiposDto } from './dto/importar-equipos.dto';
import { ListarEquiposDto } from './dto/listar-equipos.dto';
import { EquiposItService } from './equipos-it.service';
import { ImportarEquiposService } from './importacion/importar-equipos.service';

@ApiTags('Equipos IT')
@ApiBearerAuth()
// El inventario informatico lo administra solo el area de sistemas.
@Roles(RolUsuario.ADMIN)
@Controller('equipos-it')
export class EquiposItController {
  constructor(
    private readonly service: EquiposItService,
    private readonly importacion: ImportarEquiposService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un equipo informático' })
  crear(@Body() dto: CrearEquipoDto) {
    return this.service.crear(dto);
  }

  @Post('importar')
  @ApiOperation({
    summary: 'Importar el inventario desde una planilla (idempotente por código interno)',
  })
  importar(@Body() dto: ImportarEquiposDto) {
    return this.importacion.importar(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar equipos con filtros (tipo, estado, asignado, búsqueda libre)' })
  listar(@Query() query: ListarEquiposDto) {
    return this.service.listar(query);
  }

  @Get('ubicaciones')
  @ApiOperation({ summary: 'Ubicaciones ya usadas, para sugerirlas al cargar un equipo' })
  ubicaciones() {
    return this.service.ubicaciones();
  }

  @Get('resumen')
  @ApiOperation({ summary: 'Conteo de equipos por tipo y por estado' })
  resumen() {
    return this.service.resumen();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un equipo por id' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Get(':id/asignaciones')
  @ApiOperation({ summary: 'Historial de asignaciones del equipo' })
  asignaciones(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listarAsignaciones(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar los datos de un equipo' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarEquipoDto) {
    return this.service.actualizar(id, dto);
  }

  @Patch(':id/asignar')
  @ApiOperation({
    summary: 'Asignar el equipo a un usuario (o devolverlo a depósito con usuarioId null)',
  })
  asignar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarEquipoDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    return this.service.asignar(id, dto, usuario);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un equipo (solo si no está asignado)' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(id);
  }
}
