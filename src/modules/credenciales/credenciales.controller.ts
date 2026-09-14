import {
  Body,
  Controller,
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
import { RolUsuario } from '@prisma/client';
import type { Usuario } from '@prisma/client';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { UsuarioActual } from '../../common/auth/decorators/usuario-actual.decorator';
import { CredencialesService } from './credenciales.service';
import {
  ActualizarCredencialDto,
  CrearCredencialDto,
  ListarCredencialesDto,
  RotarCredencialDto,
} from './dto/credencial.dto';

/**
 * El baúl de credenciales.
 *
 * ADMIN y solo ADMIN, a nivel del controlador entero. No hay un endpoint que
 * se pueda olvidar de pedir el rol, porque el rol se pide una vez acá arriba.
 */
@ApiTags('Credenciales')
@ApiBearerAuth()
@Roles(RolUsuario.ADMIN)
@Controller('credenciales')
export class CredencialesController {
  constructor(private readonly service: CredencialesService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar credenciales',
    description:
      'Nunca devuelve contraseñas. Para ver una hay que pedirla con POST /credenciales/:id/revelar.',
  })
  listar(@Query() query: ListarCredencialesDto) {
    return this.service.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'La ficha de una credencial, sin la contraseña' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Get(':id/historial')
  @ApiOperation({
    summary: 'Cuándo se rotó y quién vio la contraseña',
    description: 'Las rotaciones no incluyen las contraseñas viejas, solo el hecho de que se rotó.',
  })
  historial(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.historial(id);
  }

  @Post()
  @ApiOperation({ summary: 'Guardar un acceso nuevo' })
  crear(@Body() dto: CrearCredencialDto) {
    return this.service.crear(dto);
  }

  @Post(':id/revelar')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Ver la contraseña',
    description:
      'Queda registrado quién la vio y cuándo. Es POST y no GET a propósito: un GET termina ' +
      'en el historial del navegador y en los registros de acceso del servidor.',
  })
  revelar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: Usuario) {
    return this.service.revelar(id, usuario);
  }

  @Post(':id/rotar')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cambiar la contraseña',
    description: 'Rechaza una contraseña que ya se haya usado en esta credencial.',
  })
  rotar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RotarCredencialDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.service.rotar(id, dto, usuario);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar la ficha, o desactivarla',
    description: 'La contraseña no se edita por acá: se cambia rotando, para que quede registro.',
  })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarCredencialDto) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Borrar una credencial y su historial',
    description:
      'Para "ya no la uso" conviene desactivarla: conserva el registro de quién vio qué.',
  })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(id);
  }
}
