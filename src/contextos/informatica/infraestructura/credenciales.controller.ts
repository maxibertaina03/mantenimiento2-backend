import {
  Body,
  Controller,
  Inject,
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
import type { Usuario } from '@prisma/client';
import { UseFilters } from '@nestjs/common';
import { UsuarioActual } from '../../../common/auth/decorators/usuario-actual.decorator';
import { FiltroErroresDominio } from '../../../common/dominio/filtro-errores-dominio';
import { GestionarCredenciales } from '../aplicacion/gestionar-credenciales';
import {
  REPOSITORIO_CREDENCIALES,
  RepositorioCredenciales,
} from '../puertos/repositorio-credenciales';
import { COFRE, Cofre } from '../puertos/cofre';
import { CONSULTA_EQUIPOS_IT_BAUL, ConsultaEquiposIt } from '../puertos/consulta-equipos-it';
import { RELOJ_INFORMATICA, Reloj } from '../puertos/reloj';
import {
  ActualizarCredencialDto,
  CredencialRespuestaDto,
  CrearCredencialDto,
  ListarCredencialesDto,
  RotarCredencialDto,
} from './credenciales.dto';
import { Permisos } from '../../../common/auth/decorators/permisos.decorator';
import { PERMISOS } from '../../../common/auth/permisos';

/**
 * El baúl de credenciales.
 *
 * ADMIN y solo ADMIN, a nivel del controlador entero. No hay un endpoint que
 * se pueda olvidar de pedir el rol, porque el rol se pide una vez acá arriba.
 */
@ApiTags('Credenciales')
@ApiBearerAuth()
@UseFilters(FiltroErroresDominio)
@Controller('credenciales')
export class CredencialesController {
  private readonly gestionar: GestionarCredenciales;

  constructor(
    @Inject(REPOSITORIO_CREDENCIALES) repo: RepositorioCredenciales,
    @Inject(COFRE) cofre: Cofre,
    @Inject(CONSULTA_EQUIPOS_IT_BAUL) equipos: ConsultaEquiposIt,
    @Inject(RELOJ_INFORMATICA) private readonly reloj: Reloj,
  ) {
    this.gestionar = new GestionarCredenciales(repo, cofre, equipos, reloj);
  }

  /** La respuesta que sale por la API, con el estado de rotacion calculado a hoy. */
  private responder(c: Parameters<typeof CredencialRespuestaDto.desde>[0]) {
    return CredencialRespuestaDto.desde(c, this.reloj.ahora());
  }

  @Permisos(PERMISOS.CREDENCIALES_VER)
  @Get()
  @ApiOperation({
    summary: 'Listar credenciales',
    description:
      'Nunca devuelve contraseñas. Para ver una hay que pedirla con POST /credenciales/:id/revelar.',
  })
  async listar(@Query() query: ListarCredencialesDto) {
    const pagina = await this.gestionar.listar(
      {
        buscar: query.buscar,
        tipo: query.tipo,
        equipoItId: query.equipoItId,
        incluirInactivas: query.mostrar === 'todas',
        soloPorVencer: query.rotacion === 'por-vencer' || query.rotacion === 'vencida',
      },
      query.pagina ?? 1,
      query.limite ?? 20,
    );
    return { ...pagina, datos: pagina.datos.map((c) => this.responder(c)) };
  }

  @Permisos(PERMISOS.CREDENCIALES_VER)
  @Get(':id')
  @ApiOperation({ summary: 'La ficha de una credencial, sin la contraseña' })
  async obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.responder(await this.gestionar.obtener(id));
  }

  @Permisos(PERMISOS.CREDENCIALES_VER)
  @Get(':id/historial')
  @ApiOperation({
    summary: 'Cuándo se rotó y quién vio la contraseña',
    description: 'Las rotaciones no incluyen las contraseñas viejas, solo el hecho de que se rotó.',
  })
  async historial(@Param('id', ParseUUIDPipe) id: string) {
    const { rotaciones, vistas } = await this.gestionar.historial(id);
    return {
      rotaciones: rotaciones.map((r) => ({
        id: r.id,
        rotadaEn: r.rotadaEn,
        rotadaPor: r.rotadaPorNombre,
        motivo: r.motivo,
      })),
      vistas: vistas.map((v) => ({
        id: v.id,
        vistaEn: v.vistaEn,
        usuario: v.usuarioNombre ?? 'desconocido',
      })),
    };
  }

  @Permisos(PERMISOS.CREDENCIALES_EDITAR)
  @Post()
  @ApiOperation({ summary: 'Guardar un acceso nuevo' })
  async crear(@Body() dto: CrearCredencialDto) {
    return this.responder(await this.gestionar.crear(dto));
  }

  @Permisos(PERMISOS.CREDENCIALES_REVELAR)
  @Post(':id/revelar')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Ver la contraseña',
    description:
      'Queda registrado quién la vio y cuándo. Es POST y no GET a propósito: un GET termina ' +
      'en el historial del navegador y en los registros de acceso del servidor.',
  })
  revelar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario?: Usuario) {
    return this.gestionar.revelar(id, usuario?.id ?? null);
  }

  @Permisos(PERMISOS.CREDENCIALES_EDITAR)
  @Post(':id/rotar')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cambiar la contraseña',
    description: 'Rechaza una contraseña que ya se haya usado en esta credencial.',
  })
  async rotar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RotarCredencialDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    return this.responder(
      await this.gestionar.rotar(id, dto.secreto, dto.motivo ?? null, usuario?.id ?? null),
    );
  }

  @Permisos(PERMISOS.CREDENCIALES_EDITAR)
  @Patch(':id')
  @ApiOperation({
    summary: 'Editar la ficha, o desactivarla',
    description: 'La contraseña no se edita por acá: se cambia rotando, para que quede registro.',
  })
  async actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarCredencialDto) {
    return this.responder(await this.gestionar.actualizar(id, dto));
  }

  @Permisos(PERMISOS.CREDENCIALES_EDITAR)
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Borrar una credencial y su historial',
    description:
      'Para "ya no la uso" conviene desactivarla: conserva el registro de quién vio qué.',
  })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.gestionar.eliminar(id);
  }
}
