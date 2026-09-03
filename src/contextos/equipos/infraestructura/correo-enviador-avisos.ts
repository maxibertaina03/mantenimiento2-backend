import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CorreoService } from '../../../common/correo/correo.service';
import { EnviadorDeAvisos } from '../puertos/enviador-avisos';

/**
 * Manda el aviso con el servicio de correo que ya usa el resto del sistema.
 *
 * Existe para que el caso de uso no dependa de `CorreoService`: lo único que
 * necesita saber es "mandá esto a estas direcciones". Así se prueba con un
 * doble en memoria, sin Nest y sin red.
 */
@Injectable()
export class CorreoEnviadorAvisos implements EnviadorDeAvisos {
  constructor(
    private readonly correo: CorreoService,
    private readonly config: ConfigService,
  ) {}

  estaConfigurado(): boolean {
    return this.correo.estaConfigurado();
  }

  async enviar(destinatarios: string[], asunto: string, cuerpo: string): Promise<void> {
    await this.correo.enviar({
      para: destinatarios,
      asunto,
      texto: cuerpo,
      nombreRemitente: 'Mantenimiento — Lácteos Las Tres',
      // Si alguien contesta el aviso, que le llegue a mantenimiento y no al
      // vacío de una casilla que nadie mira.
      responderA: this.config.get<string>('MAIL_AVISOS')?.split(',')[0]?.trim() || undefined,
    });
  }
}
