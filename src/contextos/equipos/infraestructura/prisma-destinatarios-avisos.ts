import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { esEmailUtilizable } from '../dominio/aviso';
import { DestinatariosAvisos } from '../puertos/destinatarios-avisos';

/**
 * Los destinatarios salen de la configuración y de la tabla de usuarios.
 *
 * La casilla fija (`MAIL_AVISOS`) va siempre, y además los usuarios que pueden
 * entrar al módulo. Hoy Equipos es solo para administradores, así que son los
 * usuarios con rol ADMIN: si mañana el módulo se abre a otros roles, se cambia
 * acá y en ningún otro lado.
 */
@Injectable()
export class PrismaDestinatariosAvisos implements DestinatariosAvisos {
  private readonly logger = new Logger(PrismaDestinatariosAvisos.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async obtener(): Promise<string[]> {
    const fija = (this.config.get<string>('MAIL_AVISOS') ?? '')
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d !== '');

    const admins = await this.prisma.usuario.findMany({
      where: { rol: 'ADMIN' },
      select: { email: true },
    });

    const utilizables = [...fija, ...admins.map((u) => u.email)].filter(esEmailUtilizable);

    // Sin duplicados y sin distinguir mayúsculas: la misma casilla cargada como
    // fija y como usuario recibiría el aviso dos veces.
    const unicos = new Map<string, string>();
    for (const d of utilizables) unicos.set(d.toLowerCase(), d);

    const resultado = [...unicos.values()];
    if (resultado.length === 0) {
      this.logger.warn(
        'No hay ninguna dirección a la que mandar los avisos. Configurá MAIL_AVISOS ' +
          'o cargá el correo real de algún administrador.',
      );
    }
    return resultado;
  }
}
