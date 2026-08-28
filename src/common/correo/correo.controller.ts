import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CorreoService } from './correo.service';

@ApiTags('Correo')
@ApiBearerAuth()
@Controller('correo')
export class CorreoController {
  constructor(private readonly correo: CorreoService) {}

  /**
   * Diagnóstico del envío automático.
   *
   * Existe porque hay dos formas distintas de que el correo no ande: que falten
   * las credenciales, o que el hosting bloquee el puerto SMTP saliente. Sin
   * esto, la segunda recién aparecería al intentar mandar una orden real.
   */
  @Get('estado')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Verificar que el envío automático de correo esté funcionando' })
  async estado() {
    if (!this.correo.estaConfigurado()) {
      return {
        configurado: false,
        conecta: false,
        detalle:
          'Faltan las variables SMTP_HOST, SMTP_USER o SMTP_PASS. ' +
          'El sistema sigue ofreciendo el envío manual.',
      };
    }
    const { ok, detalle } = await this.correo.verificar();
    return { configurado: true, conecta: ok, detalle };
  }
}
