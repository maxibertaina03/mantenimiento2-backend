import {
  Body,
  Controller,
  UseFilters,
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
import { UsuarioActual } from '../../../common/auth/decorators/usuario-actual.decorator';
import { Permisos } from '../../../common/auth/decorators/permisos.decorator';
import { PERMISOS } from '../../../common/auth/permisos';
import { FiltroErroresDominio } from '../../../common/dominio/filtro-errores-dominio';
import { GestionarEquiposIt } from '../aplicacion/gestionar-equipos-it';
import { ActualizarEquipoDto } from './equipos-it/actualizar-equipo.dto';
import { AsignarEquipoDto } from './equipos-it/asignar-equipo.dto';
import { CrearEquipoDto } from './equipos-it/crear-equipo.dto';
import { AsignacionRespuestaDto, EquipoRespuestaDto } from './equipos-it/equipo-respuesta.dto';
import { ImportarEquiposDto } from './equipos-it/importar-equipos.dto';
import { ListarEquiposDto } from './equipos-it/listar-equipos.dto';
import { MarcarQrDto } from './equipos-it/marcar-qr.dto';
import { ImportarEquiposItService } from './importar-equipos-it.service';

/** Las fechas llegan como texto: el caso de uso trabaja con fechas de verdad. */
function comoFecha(texto: string | undefined): Date | undefined {
  return texto ? new Date(texto) : undefined;
}

@ApiTags('Equipos IT')
@ApiBearerAuth()
// El inventario informatico lo administra solo el area de sistemas.
@UseFilters(FiltroErroresDominio)
@Controller('equipos-it')
export class EquiposItController {
  constructor(
    private readonly gestionar: GestionarEquiposIt,
    private readonly importacion: ImportarEquiposItService,
  ) {}

  @Permisos(PERMISOS.IT_EDITAR)
  @Post()
  @ApiOperation({ summary: 'Registrar un equipo informático' })
  async crear(@Body() dto: CrearEquipoDto) {
    const creado = await this.gestionar.crear({
      ...dto,
      fechaCompra: comoFecha(dto.fechaCompra),
      garantiaHasta: comoFecha(dto.garantiaHasta),
    });
    return EquipoRespuestaDto.desde(creado);
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
  async listar(@Query() query: ListarEquiposDto) {
    const pagina = await this.gestionar.listar(
      {
        buscar: query.buscar,
        tipoId: query.tipoId,
        estado: query.estado,
        responsableId: query.responsableId,
        marcaId: query.marcaId,
        ubicacionId: query.ubicacionId,
        sinResponsable: query.sinResponsable === 'true',
        sinQr: query.sinQr === 'true',
      },
      query.pagina,
      query.limite,
    );
    return { ...pagina, datos: pagina.datos.map((e) => EquipoRespuestaDto.desde(e)) };
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
    return this.gestionar.marcarQrGenerado(dto.ids).then((marcados) => ({ marcados }));
  }

  // Declarada ANTES de @Get(':id') o la ruta la tomaría como un id.
  @Permisos(PERMISOS.IT_VER)
  @Get('resumen')
  @ApiOperation({ summary: 'Conteo de equipos por tipo y por estado' })
  resumen() {
    return this.gestionar.resumen();
  }

  @Permisos(PERMISOS.IT_VER)
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un equipo por id' })
  async obtener(@Param('id', ParseUUIDPipe) id: string) {
    return EquipoRespuestaDto.desde(await this.gestionar.obtener(id));
  }

  @Permisos(PERMISOS.IT_VER)
  @Get(':id/asignaciones')
  @ApiOperation({ summary: 'Historial de asignaciones del equipo' })
  async asignaciones(@Param('id', ParseUUIDPipe) id: string) {
    const tramos = await this.gestionar.listarAsignaciones(id);
    return tramos.map((t) => AsignacionRespuestaDto.desde(t));
  }

  @Permisos(PERMISOS.IT_EDITAR)
  @Patch(':id')
  @ApiOperation({ summary: 'Editar los datos de un equipo' })
  async actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarEquipoDto) {
    const actualizado = await this.gestionar.actualizar(id, {
      ...dto,
      fechaCompra: comoFecha(dto.fechaCompra),
      garantiaHasta: comoFecha(dto.garantiaHasta),
    });
    return EquipoRespuestaDto.desde(actualizado);
  }

  @Permisos(PERMISOS.IT_EDITAR)
  @Patch(':id/asignar')
  @ApiOperation({
    summary: 'Asignar el equipo a un usuario (o devolverlo a depósito con usuarioId null)',
  })
  async asignar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarEquipoDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    const asignado = await this.gestionar.asignar(
      id,
      dto.responsableId ?? null,
      usuario?.id ?? null,
      dto.motivo,
      dto.notas,
    );
    return EquipoRespuestaDto.desde(asignado);
  }

  @Permisos(PERMISOS.IT_EDITAR)
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un equipo (solo si no está asignado)' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.gestionar.eliminar(id);
  }
}
