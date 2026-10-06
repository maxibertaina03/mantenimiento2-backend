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
import type { Usuario } from '@prisma/client';
import { UsuarioActual } from '../../../common/auth/decorators/usuario-actual.decorator';
import { ActualizarEquipo } from '../aplicacion/actualizar-equipo';
import { ConsultarEquipos, aEquipoParaMostrar } from '../aplicacion/consultar-equipos';
import { CambiarFotoEquipo } from '../aplicacion/cambiar-foto-equipo';
import { ConsultarHistorial } from '../aplicacion/consultar-historial';
import { GestionarPlanes } from '../aplicacion/gestionar-planes';
import { CrearEquipo } from '../aplicacion/crear-equipo';
import { RegistrarIntervencion } from '../aplicacion/registrar-intervencion';
import { ImportarEquipos } from '../aplicacion/importar-equipos';
import { detectarEquipos } from '../dominio/importacion';
import { ALMACEN_IMAGENES, AlmacenImagenes } from '../puertos/almacen-imagenes';
import { REPOSITORIO_EQUIPOS, RepositorioEquipos } from '../puertos/repositorio-equipos';
import { RELOJ, Reloj } from '../puertos/reloj';
import {
  ActualizarEquipoDto,
  CambiarFotoDto,
  CrearEquipoDto,
  ListarEquiposDto,
} from './equipos.dto';
import { FiltroErroresDominio } from '../../../common/dominio/filtro-errores-dominio';
import { DetectarImportacionDto, ImportarEquiposDto } from './importacion.dto';
import { RegistrarIntervencionDto } from './intervenciones.dto';
import { ActualizarPlanDto, CrearPlanDto } from './planes.dto';
import { MarcarQrDto } from './qr.dto';
import { Permisos } from '../../../common/auth/decorators/permisos.decorator';
import { PERMISOS } from '../../../common/auth/permisos';

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
@Controller('equipos')
export class EquiposController {
  // Los casos de uso llegan armados: se componen en casos-de-uso.providers.ts.
  constructor(
    private readonly crear: CrearEquipo,
    private readonly actualizar: ActualizarEquipo,
    private readonly consultar: ConsultarEquipos,
    private readonly importar: ImportarEquipos,
    private readonly cambiarFoto: CambiarFotoEquipo,
    private readonly registrarIntervencion: RegistrarIntervencion,
    private readonly historial: ConsultarHistorial,
    private readonly planes: GestionarPlanes,
    @Inject(REPOSITORIO_EQUIPOS) private readonly repo: RepositorioEquipos,
    @Inject(ALMACEN_IMAGENES) private readonly almacen: AlmacenImagenes,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  /** Las fechas llegan como texto ISO y el dominio trabaja con Date. */
  private aFecha(valor: string | null | undefined): Date | null | undefined {
    if (valor === undefined) return undefined;
    return valor === null ? null : new Date(valor);
  }

  @Permisos(PERMISOS.EQUIPOS_VER)
  @Get()
  @ApiOperation({ summary: 'Listar equipos (paginado, con filtros)' })
  listar(@Query() query: ListarEquiposDto) {
    return this.consultar.listar({
      buscar: query.buscar,
      ubicacionId: query.ubicacionId,
      tipoId: query.tipoId,
      marcaId: query.marcaId,
      modeloId: query.modeloId,
      estado: query.estado,
      clasificacion: query.clasificacion,
      sinQr: query.sinQr === 'true',
      // El corte de garantía es "hoy", y hoy lo dice el reloj del contexto.
      garantiaVencidaAl: query.garantiaVencida === 'true' ? new Date() : undefined,
      ordenarPor: query.ordenarPor,
      direccion: query.direccion,
      skip: query.skip,
      take: query.limite,
    });
  }

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
  @Post('qr/marcar-generados')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dejar constancia de que a estos equipos se les imprimió la etiqueta QR',
    description:
      'Lo llama la pantalla después de mandar a imprimir. Sirve para no volver a ' +
      'imprimir las que ya están pegadas: son 326 máquinas y se etiquetan de a tandas.',
  })
  marcarQrGenerados(@Body() dto: MarcarQrDto) {
    return this.repo.marcarQrGenerado(dto.ids, new Date()).then((marcados) => ({ marcados }));
  }

  // Declarada ANTES de @Get(':id') o la ruta la tomaría como un id.
  @Permisos(PERMISOS.EQUIPOS_VER)
  @Get('resumen')
  @ApiOperation({
    summary: 'Cuántos equipos hay y qué opciones de filtro tienen algo',
    description:
      'Los tipos y ubicaciones que devuelve son SOLO los que tienen equipos dentro del filtro ' +
      'que se le pase. Es lo que evita ofrecer 49 ubicaciones cuando 33 están vacías.',
  })
  resumen(@Query() query: ListarEquiposDto) {
    return this.repo.resumen({
      clasificacion: query.clasificacion,
      estado: query.estado,
      buscar: query.buscar,
    });
  }

  @Permisos(PERMISOS.EQUIPOS_VER)
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un equipo' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.consultar.obtener(id);
  }

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
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

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
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

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
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

  @Permisos(PERMISOS.EQUIPOS_VER)
  @Get('almacen/estado')
  @ApiOperation({
    summary: 'Si la carga de fotos está disponible',
    description: 'La pantalla oculta el campo de foto cuando no lo está.',
  })
  estadoAlmacen() {
    return { disponible: this.almacen.estaConfigurado() };
  }

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
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

  @Permisos(PERMISOS.SERVICIOS_VER)
  @Get('planes/vencen')
  @ApiOperation({
    summary: 'Los servicios que vencen, de lo más urgente a lo menos',
    description:
      'Incluye los ya vencidos: si nadie los hizo, dejar de mostrarlos sería lo contrario de ' +
      'lo que hace falta. No incluye equipos fuera de servicio ni dados de baja.',
  })
  planesQueVencen(@Query('dias') dias?: string) {
    return this.planes.listarQueVencen(dias ? Number(dias) : 7);
  }

  @Permisos(PERMISOS.EQUIPOS_VER)
  @Get(':id/planes')
  @ApiOperation({ summary: 'Planes de mantenimiento de un equipo' })
  planesDelEquipo(@Param('id', ParseUUIDPipe) id: string) {
    return this.planes.listarPorEquipo(id);
  }

  @Permisos(PERMISOS.SERVICIOS_EDITAR)
  @Post(':id/planes')
  @ApiOperation({ summary: 'Definir un plan de mantenimiento' })
  crearPlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CrearPlanDto) {
    return this.planes.crear({
      ...dto,
      equipoId: id,
      proximaFecha: new Date(dto.proximaFecha),
    });
  }

  @Permisos(PERMISOS.SERVICIOS_EDITAR)
  @Patch('planes/:planId')
  @ApiOperation({ summary: 'Editar un plan, o desactivarlo' })
  actualizarPlan(@Param('planId', ParseUUIDPipe) planId: string, @Body() dto: ActualizarPlanDto) {
    return this.planes.actualizar(planId, {
      ...dto,
      proximaFecha: dto.proximaFecha ? new Date(dto.proximaFecha) : undefined,
    });
  }

  @Permisos(PERMISOS.SERVICIOS_EDITAR)
  @Delete('planes/:planId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Eliminar un plan',
    description:
      'Los trabajos ya registrados NO se borran: el trabajo pasó, exista o no el plan. Si el ' +
      'plan dejó de usarse, conviene desactivarlo en vez de borrarlo.',
  })
  eliminarPlan(@Param('planId', ParseUUIDPipe) planId: string) {
    return this.planes.eliminar(planId);
  }

  @Permisos(PERMISOS.EQUIPOS_VER)
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

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
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
      planId: dto.planId ?? null,
      fecha: new Date(dto.fecha),
      registradoPorId: usuario?.id ?? null,
    });
  }

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
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

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
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
