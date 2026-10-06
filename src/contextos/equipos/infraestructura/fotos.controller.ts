import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseFilters,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Usuario } from '@prisma/client';
import { Permisos } from '../../../common/auth/decorators/permisos.decorator';
import { UsuarioActual } from '../../../common/auth/decorators/usuario-actual.decorator';
import { PERMISOS } from '../../../common/auth/permisos';
import { FiltroErroresDominio } from '../../../common/dominio/filtro-errores-dominio';
import { GestionarFotos } from '../aplicacion/gestionar-fotos';
import { ALMACEN_IMAGENES, AlmacenImagenes } from '../puertos/almacen-imagenes';
import { Foto, REPOSITORIO_FOTOS, RepositorioFotos } from '../puertos/fotos';
import { REPOSITORIO_EQUIPOS, RepositorioEquipos } from '../puertos/repositorio-equipos';
import { CambiarDescripcionFotoDto, SubirFotoDto } from './equipos.dto';

/** Lo que ve la pantalla de una foto: nunca la ruta interna del almacén. */
function aRespuesta(f: Foto) {
  return {
    id: f.id,
    url: f.url,
    descripcion: f.descripcion,
    subidoEn: f.subidoEn,
    subidoPor: f.subidoPorNombre,
  };
}

@ApiTags('Equipos')
@ApiBearerAuth()
@UseFilters(FiltroErroresDominio)
@Controller('equipos/:id/fotos')
export class FotosController {
  private readonly gestionar: GestionarFotos;

  constructor(
    @Inject(REPOSITORIO_FOTOS) fotos: RepositorioFotos,
    @Inject(ALMACEN_IMAGENES) almacen: AlmacenImagenes,
    @Inject(REPOSITORIO_EQUIPOS) equipos: RepositorioEquipos,
  ) {
    this.gestionar = new GestionarFotos(fotos, almacen, equipos);
  }

  @Permisos(PERMISOS.EQUIPOS_VER)
  @Get()
  @ApiOperation({
    summary: 'Las otras fotos de un equipo (la chapa, el tablero…)',
    description: 'La principal no está acá: es la `fotoUrl` del equipo.',
  })
  async listar(@Param('id', ParseUUIDPipe) id: string) {
    return (await this.gestionar.listar(id)).map(aRespuesta);
  }

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
  @Post()
  @ApiOperation({ summary: 'Agregar otra foto al equipo' })
  async subir(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubirFotoDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    const foto = await this.gestionar.subir(
      id,
      Buffer.from(dto.imagenBase64, 'base64'),
      dto.nombreArchivo,
      dto.descripcion,
      usuario?.id ?? null,
    );
    return aRespuesta(foto);
  }

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
  @Patch(':fotoId')
  @ApiOperation({ summary: 'Cambiar lo que dice una foto' })
  async describir(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fotoId', ParseUUIDPipe) fotoId: string,
    @Body() dto: CambiarDescripcionFotoDto,
  ) {
    return aRespuesta(await this.gestionar.cambiarDescripcion(id, fotoId, dto.descripcion));
  }

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
  @Post(':fotoId/principal')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Usar esta foto como la principal',
    description: 'La que era principal queda entre las otras; no se borra ninguna.',
  })
  hacerPrincipal(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fotoId', ParseUUIDPipe) fotoId: string,
  ) {
    return this.gestionar.hacerPrincipal(id, fotoId);
  }

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
  @Delete(':fotoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borrar una de las otras fotos' })
  borrar(@Param('id', ParseUUIDPipe) id: string, @Param('fotoId', ParseUUIDPipe) fotoId: string) {
    return this.gestionar.borrar(id, fotoId);
  }
}
