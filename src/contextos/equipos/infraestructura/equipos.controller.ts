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
  Query,
  UseFilters,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import type { Usuario } from '@prisma/client';
import { Roles } from '../../../common/auth/decorators/roles.decorator';
import { UsuarioActual } from '../../../common/auth/decorators/usuario-actual.decorator';
import { ActualizarEquipo } from '../aplicacion/actualizar-equipo';
import { ConsultarEquipos, aEquipoParaMostrar } from '../aplicacion/consultar-equipos';
import { CambiarFotoEquipo } from '../aplicacion/cambiar-foto-equipo';
import { ConsultarHistorial } from '../aplicacion/consultar-historial';
import { CrearEquipo } from '../aplicacion/crear-equipo';
import { RegistrarIntervencion } from '../aplicacion/registrar-intervencion';
import { ImportarEquipos } from '../aplicacion/importar-equipos';
import { detectarEquipos } from '../dominio/importacion';
import { ALMACEN_IMAGENES, AlmacenImagenes } from '../puertos/almacen-imagenes';
import {
  REPOSITORIO_INTERVENCIONES,
  RepositorioIntervenciones,
} from '../puertos/repositorio-intervenciones';
import { REPOSITORIO_EQUIPOS, RepositorioEquipos } from '../puertos/repositorio-equipos';
import {
  REPOSITORIO_UBICACIONES,
  RepositorioUbicaciones,
} from '../puertos/repositorio-ubicaciones';
import { RELOJ, Reloj } from '../puertos/reloj';
import {
  ActualizarEquipoDto,
  CambiarFotoDto,
  CrearEquipoDto,
  ListarEquiposDto,
} from './equipos.dto';
import { FiltroErroresDominio } from './filtro-errores-dominio';
import { DetectarImportacionDto, ImportarEquiposDto } from './importacion.dto';
import { RegistrarIntervencionDto } from './intervenciones.dto';

/**
 * La entrada HTTP del contexto.
 *
 * No tiene lógica: traduce la request a lo que espera el caso de uso y devuelve
 * lo que este responde. Toda regla que aparezca acá es una regla que no se
 * puede probar sin levantar Nest, y que no vale para una importación masiva ni
 * para nada que no entre por HTTP.
 */
@ApiTags('Equipos')
@ApiBearerAuth()
@UseFilters(FiltroErroresDominio)
// Todo el módulo es de admin, igual que Equipos IT. Va a nivel de clase y no
// endpoint por endpoint: así un endpoint nuevo nace protegido, en vez de nacer
// abierto y depender de que alguien se acuerde de agregarle el decorador.
@Roles(RolUsuario.ADMIN)
@Controller('equipos')
export class EquiposController {
  private readonly crear: CrearEquipo;
  private readonly actualizar: ActualizarEquipo;
  private readonly consultar: ConsultarEquipos;
  private readonly importar: ImportarEquipos;
  private readonly cambiarFoto: CambiarFotoEquipo;
  private readonly registrarIntervencion: RegistrarIntervencion;
  private readonly historial: ConsultarHistorial;

  constructor(
    @Inject(REPOSITORIO_EQUIPOS) private readonly repo: RepositorioEquipos,
    @Inject(REPOSITORIO_UBICACIONES) ubicaciones: RepositorioUbicaciones,
    @Inject(REPOSITORIO_INTERVENCIONES) intervenciones: RepositorioIntervenciones,
    @Inject(ALMACEN_IMAGENES) private readonly almacen: AlmacenImagenes,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {
    this.crear = new CrearEquipo(repo);
    this.actualizar = new ActualizarEquipo(repo);
    this.consultar = new ConsultarEquipos(repo, reloj);
    this.importar = new ImportarEquipos(repo, ubicaciones);
    this.cambiarFoto = new CambiarFotoEquipo(repo, almacen);
    this.registrarIntervencion = new RegistrarIntervencion(intervenciones, repo, reloj);
    this.historial = new ConsultarHistorial(intervenciones, repo);
  }

  /** Las fechas llegan como texto ISO y el dominio trabaja con Date. */
  private aFecha(valor: string | null | undefined): Date | null | undefined {
    if (valor === undefined) return undefined;
    return valor === null ? null : new Date(valor);
  }

  @Get()
  @ApiOperation({ summary: 'Listar equipos (paginado, con filtros)' })
  listar(@Query() query: ListarEquiposDto) {
    return this.consultar.listar({
      buscar: query.buscar,
      ubicacionId: query.ubicacionId,
      tipoId: query.tipoId,
      estado: query.estado,
      criticidad: query.criticidad,
      // El corte de garantía es "hoy", y hoy lo dice el reloj del contexto.
      garantiaVencidaAl: query.garantiaVencida === 'true' ? new Date() : undefined,
      ordenarPor: query.ordenarPor,
      direccion: query.direccion,
      skip: query.skip,
      take: query.limite,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un equipo' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.consultar.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Dar de alta un equipo' })
  async crearEquipo(@Body() dto: CrearEquipoDto) {
    const equipo = await this.crear.ejecutar({
      ...dto,
      fechaAlta: this.aFecha(dto.fechaAlta),
      garantiaHasta: this.aFecha(dto.garantiaHasta),
    });
    // Misma forma que el GET: si el alta respondiera sin `garantiaVencida`, la
    // pantalla mostraría distinto según viniera de guardar o de recargar.
    return aEquipoParaMostrar(equipo, this.reloj.ahora());
  }

  @Post('detectar-importacion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ver qué equipos saldrían de una carpeta, sin crear nada',
    description:
      'La detección vive en el dominio y se expone acá para que exista una sola copia de la ' +
      'regla. Si el navegador la repitiera, en algún momento las dos versiones diferirían y ' +
      'la pantalla mostraría algo distinto de lo que después se importa.',
  })
  detectarImportacion(@Body() dto: DetectarImportacionDto) {
    return detectarEquipos(
      dto.rutas.map((ruta) => ({ ruta })),
      dto.carpetasExcluidas,
    );
  }

  @Post('importar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Importar equipos desde la carpeta de fotos de la planta',
    description:
      'Es idempotente: un equipo que ya existe con el mismo nombre en la misma ubicación no ' +
      'se duplica, así que se puede correr de nuevo sin limpiar antes. Una fila que falla no ' +
      'frena a las demás.',
  })
  importarEquipos(@Body() dto: ImportarEquiposDto) {
    return this.importar.ejecutar(dto.filas);
  }

  @Get('almacen/estado')
  @ApiOperation({
    summary: 'Si la carga de fotos está disponible',
    description: 'La pantalla oculta el campo de foto cuando no lo está.',
  })
  estadoAlmacen() {
    return { disponible: this.almacen.estaConfigurado() };
  }

  @Post(':id/foto')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambiar la foto de un equipo' })
  async subirFoto(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CambiarFotoDto) {
    const equipo = await this.cambiarFoto.ejecutar(
      id,
      Buffer.from(dto.imagenBase64, 'base64'),
      dto.nombreArchivo,
    );
    return aEquipoParaMostrar(equipo, this.reloj.ahora());
  }

  @Get(':id/historial')
  @ApiOperation({
    summary: 'Historial de intervenciones de un equipo, con su resumen',
    description:
      'El resumen se calcula al leer y no se guarda: un total acumulado en la ficha habría ' +
      'que recalcularlo con cada alta, y bastaría un error para que quede desfasado.',
  })
  verHistorial(@Param('id', ParseUUIDPipe) id: string) {
    return this.historial.ejecutar(id);
  }

  @Post(':id/intervenciones')
  @ApiOperation({
    summary: 'Registrar un trabajo hecho sobre el equipo',
    description:
      'Una intervención no se edita: es el registro de algo que pasó. Si hay un error, se ' +
      'corrige con otra intervención que lo aclare.',
  })
  registrarTrabajo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarIntervencionDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    return this.registrarIntervencion.ejecutar({
      ...dto,
      equipoId: id,
      fecha: new Date(dto.fecha),
      registradoPorId: usuario?.id ?? null,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un equipo o cambiar su estado' })
  async actualizarEquipo(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarEquipoDto) {
    const equipo = await this.actualizar.ejecutar(id, {
      ...dto,
      fechaAlta: this.aFecha(dto.fechaAlta),
      garantiaHasta: this.aFecha(dto.garantiaHasta),
    });
    return aEquipoParaMostrar(equipo, this.reloj.ahora());
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Eliminar un equipo',
    description:
      'Para un equipo que se dejó de usar, lo correcto es darlo de baja: conserva el ' +
      'historial. Esto es para las cargas equivocadas.',
  })
  async eliminar(@Param('id', ParseUUIDPipe) id: string) {
    await this.consultar.obtener(id); // 404 con mensaje claro si no existe
    await this.repo.eliminar(id);
  }
}
