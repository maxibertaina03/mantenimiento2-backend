import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Query,
  UnauthorizedException,
  UseFilters,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'crypto';
import { Public } from '../../../common/auth/decorators/public.decorator';
import { ProcesarAvisos } from '../aplicacion/procesar-avisos';
import { DESTINATARIOS_AVISOS, DestinatariosAvisos } from '../puertos/destinatarios-avisos';
import { ENVIADOR_AVISOS, EnviadorDeAvisos } from '../puertos/enviador-avisos';
import { RELOJ, Reloj } from '../puertos/reloj';
import { REPOSITORIO_AVISOS, RepositorioAvisos } from '../puertos/repositorio-avisos';
import { REPOSITORIO_PLANES, RepositorioPlanes } from '../puertos/repositorio-planes';
import { FiltroErroresDominio } from './filtro-errores-dominio';

/** Compara sin filtrar la respuesta por el tiempo que tarda. */
function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  // timingSafeEqual explota si los largos no coinciden; eso ya es un "no".
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * El disparador de los avisos por correo.
 *
 * Lo llama GitHub Actions una vez por día, no un cron dentro de la aplicación:
 * el plan gratuito de Render **apaga el servidor cuando nadie lo usa**, así que
 * un `@Cron` de Nest no se ejecutaría justamente de madrugada, que es cuando
 * tiene que correr. Además, la llamada HTTP despierta al servidor.
 *
 * Va con token propio y no con Clerk porque quien llama es una máquina, no una
 * persona con sesión iniciada.
 */
@ApiTags('Equipos')
@Controller('avisos')
@UseFilters(FiltroErroresDominio)
export class AvisosController {
  private readonly logger = new Logger(AvisosController.name);
  private readonly caso: ProcesarAvisos;

  constructor(
    private readonly config: ConfigService,
    @Inject(REPOSITORIO_PLANES) planes: RepositorioPlanes,
    @Inject(REPOSITORIO_AVISOS) avisos: RepositorioAvisos,
    @Inject(DESTINATARIOS_AVISOS) destinatarios: DestinatariosAvisos,
    @Inject(ENVIADOR_AVISOS) enviador: EnviadorDeAvisos,
    @Inject(RELOJ) reloj: Reloj,
  ) {
    this.caso = new ProcesarAvisos(planes, avisos, destinatarios, enviador, reloj);
  }

  @Public()
  @Post('procesar')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async procesar(
    @Headers('x-token-avisos') token: string | undefined,
    @Query('dias') dias?: string,
  ) {
    const esperado = this.config.get<string>('TOKEN_AVISOS');
    if (!esperado) {
      // Sin token configurado el endpoint queda cerrado. Dejarlo abierto
      // permitiría que cualquiera dispare correos a toda la empresa.
      this.logger.error('TOKEN_AVISOS no está configurado: el disparador queda deshabilitado.');
      throw new UnauthorizedException('El disparador de avisos no está configurado.');
    }
    if (!token || !iguales(token, esperado)) {
      this.logger.warn('Intento de disparar los avisos con un token incorrecto.');
      throw new UnauthorizedException('Token inválido.');
    }

    const resultado = await this.caso.ejecutar(dias ? Number(dias) : undefined);

    // Queda en el log de Render: es lo que se mira cuando alguien pregunta por
    // qué no le llegó el aviso.
    this.logger.log(
      resultado.enviado
        ? `Aviso enviado a ${resultado.destinatarios.length} destinatario(s): ` +
            `${resultado.serviciosEnPlazo} service(s), ${resultado.nuevos} nuevo(s).`
        : `Sin envío. ${resultado.motivo ?? 'No hay services que venzan.'}`,
    );

    return resultado;
  }
}
