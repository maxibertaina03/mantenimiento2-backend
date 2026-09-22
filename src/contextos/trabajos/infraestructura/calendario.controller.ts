import {
  Body,
  Controller,
  Get,
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
import { Permisos } from '../../../common/auth/decorators/permisos.decorator';
import { UsuarioActual } from '../../../common/auth/decorators/usuario-actual.decorator';
import { PERMISOS } from '../../../common/auth/permisos';
import { ConsultarCalendario } from '../aplicacion/consultar-calendario';
import { GestionarTareas } from '../aplicacion/gestionar-tareas';
import { PLANES_DE_MANTENIMIENTO, PlanesDeMantenimiento } from '../puertos/planes-de-mantenimiento';
import { REPOSITORIO_TAREAS, RepositorioTareas } from '../puertos/repositorio-tareas';
import { CONSULTA_EQUIPOS, ConsultaEquipos } from '../puertos/consulta-equipos';
import { CONSULTA_USUARIOS, ConsultaUsuarios } from '../puertos/consulta-usuarios';
import { RELOJ_TRABAJOS, Reloj } from '../puertos/reloj';
import { STOCK, Stock } from '../puertos/stock';
import {
  REPOSITORIO_ORDENES_TRABAJO,
  RepositorioOrdenesTrabajo,
} from '../puertos/repositorio-ordenes-trabajo';
import { GestionarOrdenesTrabajo } from '../aplicacion/gestionar-ordenes-trabajo';
import { RegistrarTrabajoHecho } from '../aplicacion/registrar-trabajo-hecho';
import { UsarMateriales } from '../aplicacion/usar-materiales';
import { AvisadorDeTareas } from './avisador-de-tareas';
import { FiltroErroresTrabajo } from './filtro-errores-trabajo';
import {
  AsignarTareaDto,
  CambiarRutinaDto,
  CompletarTareaDto,
  CrearRutinaDto,
  CrearTareaDto,
  VerCalendarioDto,
} from './tareas.dto';

/**
 * El calendario: qué hay que hacer y quién lo hace.
 *
 * Vive con las órdenes de trabajo porque es la misma historia en dos momentos:
 * la tarea es el trabajo antes de hacerse, la orden es el mismo trabajo después.
 * Separarlos en dos módulos obligaría a un puente entre ellos para algo que es
 * una sola cosa.
 */
@ApiTags('Calendario')
@ApiBearerAuth()
@UseFilters(FiltroErroresTrabajo)
@Controller('calendario')
export class CalendarioController {
  private readonly consultar: ConsultarCalendario;
  private readonly gestionar: GestionarTareas;

  constructor(
    @Inject(REPOSITORIO_TAREAS) tareas: RepositorioTareas,
    @Inject(REPOSITORIO_ORDENES_TRABAJO) ordenes: RepositorioOrdenesTrabajo,
    @Inject(CONSULTA_EQUIPOS) equipos: ConsultaEquipos,
    @Inject(CONSULTA_USUARIOS) private readonly usuarios: ConsultaUsuarios,
    @Inject(PLANES_DE_MANTENIMIENTO) planes: PlanesDeMantenimiento,
    @Inject(STOCK) stock: Stock,
    @Inject(RELOJ_TRABAJOS) reloj: Reloj,
    private readonly avisador: AvisadorDeTareas,
  ) {
    this.consultar = new ConsultarCalendario(tareas, planes, reloj);
    this.gestionar = new GestionarTareas(
      tareas,
      equipos,
      usuarios,
      new RegistrarTrabajoHecho(
        new GestionarOrdenesTrabajo(ordenes, equipos, usuarios, planes, reloj),
        new UsarMateriales(ordenes, stock),
      ),
      reloj,
    );
  }

  @Permisos(PERMISOS.TAREAS_VER)
  @Get()
  @ApiOperation({ summary: 'Qué hay que hacer entre dos fechas' })
  ver(@Query() query: VerCalendarioDto) {
    return this.consultar.entre(new Date(query.desde), new Date(query.hasta), {
      asignadoAId: query.asignadoAId,
      equipoId: query.equipoId,
      soloPendientes: query.soloPendientes === 'true',
    });
  }

  /**
   * Va antes que `:id`: si no, Nest tomaría "mias" como un id y devolvería un
   * error de formato en vez de la lista.
   */
  @Permisos(PERMISOS.TAREAS_VER)
  @Get('mias')
  @ApiOperation({ summary: 'Lo que tengo que hacer hoy, y lo que quedó pendiente' })
  mias(@UsuarioActual() usuario?: Usuario) {
    if (!usuario) return [];
    return this.consultar.deHoy(usuario.id);
  }

  @Permisos(PERMISOS.TAREAS_VER)
  @Get('rutinas')
  @ApiOperation({ summary: 'Las tareas que se repiten' })
  rutinas(@Query('todas') todas?: string) {
    return this.gestionar.listarRutinas(todas !== 'true');
  }

  @Permisos(PERMISOS.TAREAS_EDITAR)
  @Post()
  @ApiOperation({ summary: 'Programar una tarea' })
  async crear(@Body() dto: CrearTareaDto, @UsuarioActual() usuario?: Usuario) {
    const tarea = await this.gestionar.crear({
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      fecha: new Date(dto.fecha),
      asignadoAId: dto.asignadoAId,
      equipoId: dto.equipoId,
      creadaPorId: usuario?.id ?? null,
    });

    await this.avisador.avisarAsignacion(tarea);
    return tarea;
  }

  @Permisos(PERMISOS.TAREAS_ASIGNAR)
  @Post(':id/asignar')
  @ApiOperation({ summary: 'Darle la tarea a alguien' })
  async asignar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AsignarTareaDto) {
    const tarea = await this.gestionar.asignar(id, dto.asignadoAId);
    await this.avisador.avisarAsignacion(tarea);
    return tarea;
  }

  @Permisos(PERMISOS.TAREAS_EDITAR)
  @Post(':id/completar')
  @ApiOperation({ summary: 'Darla por hecha: genera la orden de trabajo' })
  completar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompletarTareaDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    return this.gestionar.completar(
      id,
      {
        resolucion: dto.resolucion,
        materiales: dto.materiales,
        costoManoObra: dto.costoManoObra,
        horasParada: dto.horasParada,
      },
      usuario?.id ?? null,
    );
  }

  @Permisos(PERMISOS.TAREAS_EDITAR)
  @Post(':id/cancelar')
  @ApiOperation({ summary: 'Sacarla del calendario sin borrarla' })
  cancelar(@Param('id', ParseUUIDPipe) id: string) {
    return this.gestionar.cancelar(id);
  }

  @Permisos(PERMISOS.TAREAS_EDITAR)
  @Post('rutinas')
  @ApiOperation({ summary: 'Definir una tarea que se repite' })
  crearRutina(@Body() dto: CrearRutinaDto, @UsuarioActual() usuario?: Usuario) {
    return this.gestionar.crearRutina({
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      cadaDias: dto.cadaDias,
      desde: new Date(dto.desde),
      hasta: dto.hasta ? new Date(dto.hasta) : null,
      equipoId: dto.equipoId,
      asignadoAId: dto.asignadoAId,
      creadaPorId: usuario?.id ?? null,
    });
  }

  @Permisos(PERMISOS.TAREAS_EDITAR)
  @Patch('rutinas/:id')
  @ApiOperation({ summary: 'Cambiar o apagar una rutina' })
  cambiarRutina(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CambiarRutinaDto) {
    return this.gestionar.cambiarRutina(id, {
      ...(dto.titulo === undefined ? {} : { titulo: dto.titulo }),
      ...(dto.descripcion === undefined ? {} : { descripcion: dto.descripcion }),
      ...(dto.cadaDias === undefined ? {} : { cadaDias: dto.cadaDias }),
      ...(dto.hasta === undefined ? {} : { hasta: dto.hasta ? new Date(dto.hasta) : null }),
      ...(dto.asignadoAId === undefined ? {} : { asignadoAId: dto.asignadoAId }),
      ...(dto.activa === undefined ? {} : { activa: dto.activa }),
    });
  }
}
