import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import type { Usuario } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsEnum, IsString } from 'class-validator';
import { Permisos, SoloAutenticado } from './decorators/permisos.decorator';
import { UsuarioActual } from './decorators/usuario-actual.decorator';
import { DESCRIPCION_PERMISOS, PERMISOS, Permiso, TODOS_LOS_PERMISOS } from './permisos';
import { PermisosService } from './permisos.service';

export class GuardarPermisosDto {
  @ApiProperty({ isArray: true, type: String, example: ['ordenes.ver', 'materiales.ver'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  permisos!: string[];
}

class RolParamDto {
  @IsEnum(RolUsuario)
  rol!: RolUsuario;
}

@ApiTags('Permisos')
@ApiBearerAuth()
@Controller('permisos')
export class PermisosController {
  constructor(private readonly service: PermisosService) {}

  /**
   * Lo que puede hacer quien está mirando.
   *
   * La pantalla lo usa para no ofrecer botones que van a terminar en un error.
   * Es `@SoloAutenticado` porque preguntarse qué puedo hacer no puede depender
   * de un permiso: sin esto, alguien sin permisos no podría ni enterarse de que
   * no los tiene.
   */
  @SoloAutenticado()
  @Get('mios')
  @ApiOperation({ summary: 'Los permisos del usuario que está en sesión' })
  async mios(@UsuarioActual() usuario?: Usuario) {
    if (!usuario) return { rol: null, permisos: [] };
    const permisos = await this.service.permisosDe(usuario.rol);
    return { rol: usuario.rol, permisos: [...permisos] };
  }

  /**
   * El catálogo de permisos que existen, con su nombre en castellano.
   *
   * Sale del servidor y no de una copia en la pantalla para que un permiso
   * nuevo aparezca solo, en vez de faltar hasta que alguien se acuerde de
   * agregarlo también del otro lado.
   */
  @Permisos(PERMISOS.PERMISOS_ADMINISTRAR)
  @Get('catalogo')
  @ApiOperation({ summary: 'Todos los permisos que existen, agrupados' })
  catalogo() {
    return TODOS_LOS_PERMISOS.map((p) => ({
      permiso: p,
      grupo: DESCRIPCION_PERMISOS[p].grupo,
      etiqueta: DESCRIPCION_PERMISOS[p].etiqueta,
    }));
  }

  @Permisos(PERMISOS.PERMISOS_ADMINISTRAR)
  @Get()
  @ApiOperation({ summary: 'Qué permisos tiene cada rol' })
  porRol() {
    return this.service.porRol();
  }

  @Permisos(PERMISOS.PERMISOS_ADMINISTRAR)
  @Put(':rol')
  @ApiOperation({
    summary: 'Reemplazar los permisos de un rol',
    description:
      'Al administrador nunca se le saca el permiso de administrar permisos: sin eso, ' +
      'desmarcarlo dejaría el sistema sin nadie que pueda volver a habilitarlo.',
  })
  guardar(@Param() params: RolParamDto, @Body() dto: GuardarPermisosDto) {
    return this.service.guardar(params.rol, dto.permisos as Permiso[]);
  }
}
