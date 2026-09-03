import { aServicioAAvisar, armarMensajeAviso } from '../dominio/aviso';
import { EstadoEquipo } from '../dominio/estado-equipo';
import { DIAS_DE_AVISO, correspondeAvisar } from '../dominio/plan-mantenimiento';
import { DestinatariosAvisos } from '../puertos/destinatarios-avisos';
import { EnviadorDeAvisos } from '../puertos/enviador-avisos';
import { Reloj } from '../puertos/reloj';
import { RepositorioAvisos, claveAviso } from '../puertos/repositorio-avisos';
import { RepositorioPlanes } from '../puertos/repositorio-planes';

export interface ResultadoAvisos {
  /** Services que vencen o vencieron, se hayan avisado antes o no. */
  serviciosEnPlazo: number;
  /** Los que todavía no se habían avisado. Si es 0, no sale nada. */
  nuevos: number;
  enviado: boolean;
  destinatarios: string[];
  /** Por qué no se mandó, cuando no se mandó. Es lo que se lee en el log. */
  motivo?: string;
}

/**
 * Manda el aviso de los services que vencen.
 *
 * Lo dispara algo de afuera, no un cron interno: el plan gratuito de Render
 * apaga el servidor cuando nadie lo usa, y un cron adentro de la aplicación
 * simplemente no se ejecuta.
 *
 * **Solo manda si hay algo nuevo que avisar.** El correo lista todo lo que
 * vence —el panorama completo—, pero no sale si de todo eso ya se avisó. Sin
 * esa condición, un service vencido que nadie atiende generaría un correo
 * idéntico cada mañana, y a la semana alguien arma una regla de bandeja que los
 * archiva sin leer. Ahí el módulo entero deja de servir.
 */
export class ProcesarAvisos {
  constructor(
    private readonly planes: RepositorioPlanes,
    private readonly avisos: RepositorioAvisos,
    private readonly destinatarios: DestinatariosAvisos,
    private readonly enviador: EnviadorDeAvisos,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(diasDeAviso = DIAS_DE_AVISO): Promise<ResultadoAvisos> {
    const hoy = this.reloj.ahora();
    const corte = new Date(hoy.getTime());
    corte.setUTCDate(corte.getUTCDate() + diasDeAviso);

    const planes = await this.planes.listarQueVencenHasta(corte);

    // El corte en la consulta es para no traer 326 equipos y descartarlos acá;
    // quien decide si un plan se avisa sigue siendo el dominio. Repetir la
    // regla en el SQL y confiar en ella sería quedarse con dos versiones que
    // tarde o temprano dejan de coincidir.
    const aAvisar = planes.filter((p) =>
      correspondeAvisar(p, p.equipoEstado as EstadoEquipo, hoy, diasDeAviso),
    );
    const servicios = aAvisar.map((p) => aServicioAAvisar(p, hoy));

    if (servicios.length === 0) {
      return { serviciosEnPlazo: 0, nuevos: 0, enviado: false, destinatarios: [] };
    }

    const yaAvisados = await this.avisos.yaAvisados(
      servicios.map((s) => ({ planId: s.planId, fechaService: s.fechaService })),
    );
    const nuevos = servicios.filter((s) => !yaAvisados.has(claveAviso(s.planId, s.fechaService)));

    if (nuevos.length === 0) {
      return {
        serviciosEnPlazo: servicios.length,
        nuevos: 0,
        enviado: false,
        destinatarios: [],
        motivo: 'Ya se había avisado de todos.',
      };
    }

    const destinatarios = await this.destinatarios.obtener();
    if (destinatarios.length === 0) {
      return {
        serviciosEnPlazo: servicios.length,
        nuevos: nuevos.length,
        enviado: false,
        destinatarios: [],
        motivo: 'No hay ninguna dirección de correo a la que avisar.',
      };
    }
    if (!this.enviador.estaConfigurado()) {
      return {
        serviciosEnPlazo: servicios.length,
        nuevos: nuevos.length,
        enviado: false,
        destinatarios,
        motivo: 'El envío de correo no está configurado en el servidor.',
      };
    }

    // El correo lleva TODO lo que vence, no solo lo nuevo: quien lo lee tiene
    // que ver el panorama, no la novedad suelta.
    const { asunto, cuerpo } = armarMensajeAviso(servicios);
    await this.enviador.enviar(destinatarios, asunto, cuerpo);

    // Se registra DESPUÉS de que el correo salió. Al revés, un fallo de envío
    // dejaría los avisos marcados como hechos y nadie se enteraría nunca.
    await this.avisos.registrar(
      nuevos.map((s) => ({
        planId: s.planId,
        fechaService: s.fechaService,
        enviadoEn: hoy,
        destinatarios: destinatarios.join(', '),
      })),
    );

    return {
      serviciosEnPlazo: servicios.length,
      nuevos: nuevos.length,
      enviado: true,
      destinatarios,
    };
  }
}
