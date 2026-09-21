import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { Permisos } from '../../../common/auth/decorators/permisos.decorator';
import { UsuarioActual } from '../../../common/auth/decorators/usuario-actual.decorator';
import { PERMISOS } from '../../../common/auth/permisos';
import { PermisosService } from '../../../common/auth/permisos.service';
import { ConsultarOrdenesTrabajo } from '../aplicacion/consultar-ordenes-trabajo';
import { GestionarOrdenesTrabajo } from '../aplicacion/gestionar-ordenes-trabajo';
import { UsarMateriales } from '../aplicacion/usar-materiales';
import { CONSULTA_EQUIPOS, ConsultaEquipos } from '../puertos/consulta-equipos';
import {
  REPOSITORIO_ORDENES_TRABAJO,
  RepositorioOrdenesTrabajo,
} from '../puertos/repositorio-ordenes-trabajo';
import { RELOJ_TRABAJOS, Reloj } from '../puertos/reloj';
import { STOCK, Stock } from '../puertos/stock';
import { FiltroErroresTrabajo } from './filtro-errores-trabajo';
import {
  AnularOrdenTrabajoDto,
  CerrarOrdenTrabajoDto,
  CrearOrdenTrabajoDto,
  EditarOrdenTrabajoDto,
  ListarOrdenesTrabajoDto,
  UsarMaterialDto,
} from './ordenes-trabajo.dto';

/**
 * La entrada HTTP del contexto.
 *
 * No tiene lógica de negocio: traduce la request a lo que espera el caso de uso
 * y devuelve lo que este responde. Lo único que sí decide acá es quién puede
 * atar una orden a un equipo, y es porque esa regla depende de los permisos del
 * usuario, que son un concepto de la aplicación y no del dominio del trabajo.
 */
@ApiTags('Órdenes de trabajo')
@ApiBearerAuth()
@UseFilters(FiltroErroresTrabajo)
@Controller('ordenes-trabajo')
export class OrdenesTrabajoController {
  private readonly gestionar: GestionarOrdenesTrabajo;
  private readonly materiales: UsarMateriales;
  private readonly consultar: ConsultarOrdenesTrabajo;

  constructor(
    @Inject(REPOSITORIO_ORDENES_TRABAJO) repo: RepositorioOrdenesTrabajo,
    @Inject(CONSULTA_EQUIPOS) equipos: ConsultaEquipos,
    @Inject(STOCK) stock: Stock,
    @Inject(RELOJ_TRABAJOS) reloj: Reloj,
    private readonly permisos: PermisosService,
  ) {
    this.gestionar = new GestionarOrdenesTrabajo(repo, equipos, reloj);
    this.materiales = new UsarMateriales(repo, stock);
    this.consultar = new ConsultarOrdenesTrabajo(repo);
  }

  /**
   * Atar una orden a un equipo exige poder ver equipos.
   *
   * Mantenimiento todavía no tiene acceso al módulo de equipos, así que carga
   * órdenes sin máquina y las describe en el título. Un administrador después
   * las relaciona. Si acá no se controlara, alcanzaría con mandar un `equipoId`
   * a mano para escribir en el historial de una máquina que no se puede ni ver.
   */
  private async validarEleccionDeEquipo(
    equipoId: string | null | undefined,
    usuario?: Usuario,
  ): Promise<void> {
    if (equipoId === undefined || equipoId === null) return;
    // Sin auth (desarrollo) no hay a quién preguntarle: mismo escape hatch que
    // usan los guards.
    if (!usuario) return;

    const suyos = await this.permisos.permisosDe(usuario.rol);
    if (suyos.has(PERMISOS.EQUIPOS_VER)) return;

    throw new ForbiddenException(
      'Para relacionar una orden de trabajo con un equipo hace falta permiso para ver equipos. ' +
        'Cargala sin equipo, contando en el título de qué máquina se trata, y un administrador ' +
        'la relaciona después.',
    );
  }

  @Permisos(PERMISOS.TRABAJOS_VER)
  @Get()
  @ApiOperation({ summary: 'Listar órdenes de trabajo (paginado, con filtros)' })
  listar(@Query() query: ListarOrdenesTrabajoDto) {
    return this.consultar.listar(
      {
        buscar: query.buscar,
        estado: query.estado,
        tipo: query.tipo,
        equipoId: query.equipoId,
      },
      query.pagina ?? 1,
      query.limite ?? 20,
    );
  }

  @Permisos(PERMISOS.TRABAJOS_VER)
  @Get(':id')
  @ApiOperation({ summary: 'Una orden con sus materiales y el resumen de lo usado' })
  detalle(@Param('id', ParseUUIDPipe) id: string) {
    return this.consultar.buscarPorId(id);
  }

  @Permisos(PERMISOS.TRABAJOS_EDITAR)
  @Post()
  @ApiOperation({ summary: 'Abrir una orden de trabajo' })
  async crear(@Body() dto: CrearOrdenTrabajoDto, @UsuarioActual() usuario?: Usuario) {
    await this.validarEleccionDeEquipo(dto.equipoId, usuario);
    return this.gestionar.crear({
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      tipo: dto.tipo,
      equipoId: dto.equipoId,
      abiertaPorId: usuario?.id ?? null,
    });
  }

  @Permisos(PERMISOS.TRABAJOS_EDITAR)
  @Patch(':id')
  @ApiOperation({ summary: 'Corregir una orden abierta' })
  async editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditarOrdenTrabajoDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    await this.validarEleccionDeEquipo(dto.equipoId, usuario);
    return this.gestionar.editar(id, dto);
  }

  @Permisos(PERMISOS.TRABAJOS_EDITAR)
  @Post(':id/materiales')
  @ApiOperation({ summary: 'Cargar un material usado (lo saca del pañol)' })
  agregarMaterial(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UsarMaterialDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    return this.materiales.agregar(
      id,
      { materialId: dto.materialId, cantidad: dto.cantidad, notas: dto.notas },
      usuario?.id ?? null,
    );
  }

  @Permisos(PERMISOS.TRABAJOS_EDITAR)
  @Delete('materiales/:materialUsadoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quitar un material cargado (lo devuelve al pañol)' })
  async quitarMaterial(
    @Param('materialUsadoId', ParseUUIDPipe) materialUsadoId: string,
    @UsuarioActual() usuario?: Usuario,
  ) {
    await this.materiales.quitar(materialUsadoId, usuario?.id ?? null);
  }

  @Permisos(PERMISOS.TRABAJOS_EDITAR)
  @Post(':id/cerrar')
  @ApiOperation({ summary: 'Cerrar la orden contando qué se hizo' })
  cerrar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CerrarOrdenTrabajoDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    return this.gestionar.cerrar(id, dto.resolucion, usuario?.id ?? null);
  }

  @Permisos(PERMISOS.TRABAJOS_EDITAR)
  @Post(':id/reabrir')
  @ApiOperation({ summary: 'Volver a abrir una orden cerrada de más' })
  reabrir(@Param('id', ParseUUIDPipe) id: string) {
    return this.gestionar.reabrir(id);
  }

  @Permisos(PERMISOS.TRABAJOS_ELIMINAR)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una orden anulada que nunca movió stock' })
  async eliminar(@Param('id', ParseUUIDPipe) id: string) {
    await this.gestionar.eliminar(id);
  }

  @Permisos(PERMISOS.TRABAJOS_EDITAR)
  @Post(':id/anular')
  @ApiOperation({ summary: 'Anular una orden abierta que no movió stock' })
  anular(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AnularOrdenTrabajoDto) {
    return this.gestionar.anular(id, dto.motivo);
  }
}
