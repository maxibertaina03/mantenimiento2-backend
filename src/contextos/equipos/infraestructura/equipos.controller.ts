import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { Roles } from '../../../common/auth/decorators/roles.decorator';
import { ActualizarEquipo } from '../aplicacion/actualizar-equipo';
import { ConsultarEquipos, aEquipoParaMostrar } from '../aplicacion/consultar-equipos';
import { CrearEquipo } from '../aplicacion/crear-equipo';
import { REPOSITORIO_EQUIPOS, RepositorioEquipos } from '../puertos/repositorio-equipos';
import { RELOJ, Reloj } from '../puertos/reloj';
import { ActualizarEquipoDto, CrearEquipoDto, ListarEquiposDto } from './equipos.dto';
import { FiltroErroresDominio } from './filtro-errores-dominio';

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
@Controller('equipos')
export class EquiposController {
  private readonly crear: CrearEquipo;
  private readonly actualizar: ActualizarEquipo;
  private readonly consultar: ConsultarEquipos;

  constructor(
    @Inject(REPOSITORIO_EQUIPOS) private readonly repo: RepositorioEquipos,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {
    this.crear = new CrearEquipo(repo);
    this.actualizar = new ActualizarEquipo(repo);
    this.consultar = new ConsultarEquipos(repo, reloj);
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

  // Las altas y las bajas son de admin; las intervenciones (fase 3) las va a
  // poder cargar cualquiera, que es donde el operario aporta el dato.
  @Post()
  @Roles(RolUsuario.ADMIN)
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

  @Patch(':id')
  @Roles(RolUsuario.ADMIN)
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
  @Roles(RolUsuario.ADMIN)
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
