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
  Post,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Usuario } from '@prisma/client';
import { Permisos } from '../../../common/auth/decorators/permisos.decorator';
import { UsuarioActual } from '../../../common/auth/decorators/usuario-actual.decorator';
import { PERMISOS } from '../../../common/auth/permisos';
import { FiltroErroresDominio } from '../../../common/dominio/filtro-errores-dominio';
import { GestionarManuales } from '../aplicacion/gestionar-manuales';
import { ErrorDatosInvalidos } from '../dominio/errores';
import { MAXIMO_BYTES_MANUAL } from '../dominio/manual';
import {
  ALMACEN_MANUALES,
  AlmacenManuales,
  Manual,
  REPOSITORIO_MANUALES,
  RepositorioManuales,
} from '../puertos/manuales';
import { RELOJ, Reloj } from '../puertos/reloj';
import { REPOSITORIO_EQUIPOS, RepositorioEquipos } from '../puertos/repositorio-equipos';

/** Lo que multer entrega de un archivo subido. Solo lo que se usa. */
interface ArchivoRecibido {
  buffer: Buffer;
  originalname: string;
  size: number;
}

/** Lo que ve la pantalla de un manual: nunca la ruta interna del almacén. */
function aRespuesta(m: Manual) {
  return {
    id: m.id,
    nombre: m.nombre,
    tamanoBytes: m.tamanoBytes,
    subidoEn: m.subidoEn,
    subidoPor: m.subidoPorNombre,
  };
}

@ApiTags('Equipos')
@ApiBearerAuth()
@UseFilters(FiltroErroresDominio)
@Controller('equipos/:id/manuales')
export class ManualesController {
  private readonly gestionar: GestionarManuales;

  constructor(
    @Inject(REPOSITORIO_MANUALES) manuales: RepositorioManuales,
    @Inject(ALMACEN_MANUALES) almacen: AlmacenManuales,
    @Inject(REPOSITORIO_EQUIPOS) equipos: RepositorioEquipos,
    @Inject(RELOJ) reloj: Reloj,
  ) {
    this.gestionar = new GestionarManuales(manuales, almacen, equipos, reloj);
  }

  @Permisos(PERMISOS.EQUIPOS_VER)
  @Get()
  @ApiOperation({
    summary: 'Los manuales en PDF de un equipo o herramienta',
    description: 'No devuelve el archivo: para abrirlo se pide un enlace, que vence.',
  })
  async listar(@Param('id', ParseUUIDPipe) id: string) {
    return {
      disponible: this.gestionar.estaDisponible(),
      manuales: (await this.gestionar.listar(id)).map(aRespuesta),
    };
  }

  @Permisos(PERMISOS.EQUIPOS_VER)
  @Get(':manualId/enlace')
  @ApiOperation({ summary: 'Un enlace para abrir el manual, que vence a los cinco minutos' })
  enlace(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('manualId', ParseUUIDPipe) manualId: string,
  ) {
    return this.gestionar.enlace(id, manualId);
  }

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Subir un manual en PDF',
    description:
      'Va como archivo (multipart) y no dentro del JSON: un manual pesa varios megas, y ' +
      'codificado en el JSON no entraría en el límite de los pedidos.',
  })
  // El tope de multer es un poco más alto que el de la regla, así el que se
  // pasa por poco recibe el mensaje en castellano del dominio y no un 413.
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAXIMO_BYTES_MANUAL + 5 * 1024 * 1024 } }),
  )
  async subir(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() archivo: ArchivoRecibido | undefined,
    // El nombre viaja aparte, como texto: multer puede desfigurar los acentos
    // del nombre original del archivo.
    @Body('nombre') nombre: string | undefined,
    @UsuarioActual() usuario?: Usuario,
  ) {
    if (!archivo) {
      throw new ErrorDatosInvalidos('No llegó ningún archivo. Elegí el PDF y probá de nuevo.');
    }
    const manual = await this.gestionar.subir(
      id,
      archivo.buffer,
      nombre?.trim() || archivo.originalname,
      usuario?.id ?? null,
    );
    return aRespuesta(manual);
  }

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
  @Delete(':manualId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borrar un manual' })
  borrar(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('manualId', ParseUUIDPipe) manualId: string,
  ) {
    return this.gestionar.borrar(id, manualId);
  }
}
