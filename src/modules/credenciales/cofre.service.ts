import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cofre, ErrorDeCofre, generarClave, leerClave } from './cofre';

/**
 * El cofre, enchufado a la configuración.
 *
 * Si `CLAVE_SECRETOS` no está, el baúl queda deshabilitado y el resto del
 * sistema funciona igual, como pasa con el almacén de fotos. Es preferible a
 * que la aplicación entera no arranque: un servidor caído por una variable que
 * falta es peor que una pantalla que explica qué falta.
 *
 * Lo que NO se hace es guardar en claro cuando falta la clave. Eso sería
 * silencioso, y el día que alguien lo notara ya habría contraseñas escritas en
 * la base sin protección.
 */
@Injectable()
export class CofreService {
  private readonly logger = new Logger(CofreService.name);
  private readonly cofre: Cofre | null;

  constructor(config: ConfigService) {
    const valor = config.get<string>('CLAVE_SECRETOS');

    if (!valor) {
      this.cofre = null;
      this.logger.warn(
        'Baúl de credenciales deshabilitado: falta CLAVE_SECRETOS. ' +
          `Generá una con: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" ` +
          'y guardala fuera de la base. Si se pierde, las contraseñas no se recuperan.',
      );
      return;
    }

    try {
      this.cofre = new Cofre(leerClave(valor));
      this.logger.log('Baúl de credenciales activo.');
    } catch (e) {
      // Una clave mal formada NO se ignora en silencio: es un error de
      // configuración que hay que arreglar, no una función opcional apagada.
      const motivo = e instanceof ErrorDeCofre ? e.message : String(e);
      throw new Error(`CLAVE_SECRETOS inválida. ${motivo}`);
    }
  }

  get estaDisponible(): boolean {
    return this.cofre !== null;
  }

  private exigir(): Cofre {
    if (!this.cofre) {
      throw new ServiceUnavailableException(
        'El baúl de credenciales no está configurado en este servidor. ' +
          'Falta la variable CLAVE_SECRETOS.',
      );
    }
    return this.cofre;
  }

  cifrar(secreto: string): string {
    return this.exigir().cifrar(secreto);
  }

  descifrar(guardado: string): string {
    return this.exigir().descifrar(guardado);
  }

  huella(secreto: string): string {
    return this.exigir().huella(secreto);
  }

  coincideConLaHuella(secreto: string, huella: string): boolean {
    return this.exigir().coincideConLaHuella(secreto, huella);
  }

  /** Para el comando que genera una clave nueva al configurar el servidor. */
  static sugerirClave(): string {
    return generarClave();
  }
}
