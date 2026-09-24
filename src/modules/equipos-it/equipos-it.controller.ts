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
import { ActualizarEquipoDto } from './dto/actualizar-equipo.dto';
import { AsignarEquipoDto } from './dto/asignar-equipo.dto';
import { CrearEquipoDto } from './dto/crear-equipo.dto';
import { ImportarEquiposDto } from './dto/importar-equipos.dto';
import { ListarEquiposDto } from './dto/listar-equipos.dto';
import { MarcarQrDto } from './dto/marcar-qr.dto';
import { EquiposItService } from './equipos-it.service';
import { ImportarEquiposService } from './importacion/importar-equipos.service';
import { Permisos } from '../../common/auth/decorators/permisos.decorator';
import { PERMISOS } from '../../common/auth/permisos';

@ApiTags('Equipos IT')
@ApiBearerAuth()
// El inventario informatico lo administra solo el area de sistemas.
@Controller('equipos-it')
export class EquiposItController {
  constructor(
    private readonly service: EquiposItService,
    private readonly importacion: ImportarEquiposService,
  ) {}

  @Permisos(PERMISOS.IT_EDITAR)
  @Post()
  @ApiOperation({ summary: 'Registrar un equipo informático' })
  crear(@Body() dto: CrearEquipoDto) {
    return this.service.crear(dto);
  }

  @Permisos(PERMISOS.IT_EDITAR)
  @Post('importar')
  @ApiOperation({
    summary: 'Importar el inventario desde una planilla (idempotente por código interno)',
  })
  importar(@Body() dto: ImportarEquiposDto) {
    return this.importacion.importar(dto);
  }

  @Permisos(PERMISOS.IT_VER)
  @Get()
  @ApiOperation({
    summary: 'Listar equipos con filtros (tipo, estado, responsable, marca, ubicación, búsqueda)',
  })
  listar(@Query() query: ListarEquiposDto) {
    return this.service.listar(query);
  }

  @Permisos(PERMISOS.IT_EDITAR)
  @Post('qr/marcar-generados')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dejar constancia de que a estos equipos se les imprimió la etiqueta QR',
    description:
      'Lo llama la pantalla después de mandar a imprimir, para no volver a imprimir las que ' +
      'ya están pegadas.',
  })
  marcarQrGenerados(@Body() dto: MarcarQrDto) {
    return this.service.marcarQrGenerado(dto.ids).then((marcados) => ({ marcados }));
  }

  // Declarada ANTES de @Get(':id') o la ruta la tomaría como un id.
  @Permisos(PERMISOS.IT_VER)
  @Get('resumen')
  @ApiOperation({ summary: 'Conteo de equipos por tipo y por estado' })
  resumen() {
    return this.service.resumen();
  }

  @Permisos(PERMISOS.IT_VER)
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un equipo por id' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Permisos(PERMISOS.IT_VER)
  @Get(':id/asignaciones')
  @ApiOperation({ summary: 'Historial de asignaciones del equipo' })
  asignaciones(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listarAsignaciones(id);
  }

  @Permisos(PERMISOS.IT_EDITAR)
  @Patch(':id')
  @ApiOperation({ summary: 'Editar los datos de un equipo' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarEquipoDto) {
    return this.service.actualizar(id, dto);
  }

  @Permisos(PERMISOS.IT_EDITAR)
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

  @Permisos(PERMISOS.IT_EDITAR)
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un equipo (solo si no está asignado)' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(id);
  }
}
