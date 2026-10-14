import {
  ErrorCorreoNoConfigurado,
  ErrorDatosInvalidos,
  ErrorEnvioFallido,
  ErrorNoEncontrado,
  ErrorSinDestinatario,
} from '../dominio/errores';
import { armarMensajeAlTaller } from '../dominio/mensaje-trabajo';
import { validarEnviableAlTaller } from '../dominio/orden-trabajo';
import { ContactosDeTalleres, CorreoTrabajos } from '../puertos/envio';
import {
  EnvioDeTrabajo,
  OrdenTrabajoConRelaciones,
  RepositorioOrdenesTrabajo,
} from '../puertos/repositorio-ordenes-trabajo';

/** Quién manda la orden: el taller le contesta a esa persona. */
export interface QuienEnvia {
  id: string;
  nombre?: string | null;
  email?: string | null;
}

export interface ResultadoEnvioAlTaller {
  para: string[];
  responderA: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esEmail = (valor: string | null | undefined): valor is string =>
  EMAIL.test((valor ?? '').trim());

/**
 * Mandarle la orden de trabajo al taller de afuera: por correo, con el PDF
 * adjunto, o por WhatsApp.
 *
 * Mismas reglas que las órdenes de compra. Quien llama aporta solo el PDF; el
 * texto y el destinatario salen de los datos guardados. El envío se registra
 * DESPUÉS de que el correo salió: al revés, un fallo del servidor de correo
 * dejaría constancia de algo que nunca pasó.
 */
export class EnviarOrdenesTrabajo {
  constructor(
    private readonly repo: RepositorioOrdenesTrabajo,
    private readonly correo: CorreoTrabajos,
    private readonly talleres: ContactosDeTalleres,
  ) {}

  private async traer(id: string): Promise<OrdenTrabajoConRelaciones> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) throw new ErrorNoEncontrado(`No existe la orden de trabajo con id ${id}`);
    return orden;
  }

  async porCorreo(id: string, pdf: Buffer, quien?: QuienEnvia): Promise<ResultadoEnvioAlTaller> {
    if (!this.correo.estaConfigurado()) {
      throw new ErrorCorreoNoConfigurado(
        'El envío automático de correo no está configurado. Mandásela al taller por WhatsApp.',
      );
    }
    const orden = await this.traer(id);
    validarEnviableAlTaller(orden);

    const taller = await this.talleres.contacto(orden.proveedorId!);
    const email = taller?.email?.trim();
    if (!esEmail(email)) {
      throw new ErrorSinDestinatario(
        `${orden.proveedorNombre ?? 'El taller'} no tiene correo cargado. Cargáselo desde esta ` +
          'misma pantalla, o mandásela por WhatsApp.',
      );
    }
    if (pdf.length === 0) throw new ErrorDatosInvalidos('El PDF adjunto vino vacío.');

    const { asunto, cuerpo } = armarMensajeAlTaller(orden);
    const responderA = esEmail(quien?.email) ? quien!.email!.trim() : undefined;

    try {
      await this.correo.enviar({
        para: [email],
        responderA,
        nombreRemitente: quien?.nombre
          ? `${quien.nombre} · Lácteos Las Tres S.R.L.`
          : 'Lácteos Las Tres S.R.L.',
        asunto,
        texto: cuerpo,
        adjuntos: [{ nombre: `${orden.numero}.pdf`, contenido: pdf, tipo: 'application/pdf' }],
      });
    } catch (error) {
      throw new ErrorEnvioFallido(
        `No se pudo enviar el correo: ${this.correo.explicarError(error)} ` +
          'Podés reintentar o mandársela por WhatsApp.',
      );
    }

    await this.repo.registrarEnvio({
      ordenTrabajoId: id,
      via: 'CORREO',
      destinatarios: email,
      automatico: true,
      usuarioId: quien?.id ?? null,
    });
    return { para: [email], responderA: responderA ?? null };
  }

  /**
   * Deja constancia de que se le mandó por WhatsApp.
   *
   * El chat lo abre la pantalla y la persona toca enviar, así que se registra
   * `automatico: false`: es constancia de que se abrió, no de que llegó.
   */
  async porWhatsapp(id: string, numero: string, usuarioId: string | null): Promise<EnvioDeTrabajo> {
    const orden = await this.traer(id);
    validarEnviableAlTaller(orden);
    return this.repo.registrarEnvio({
      ordenTrabajoId: id,
      via: 'WHATSAPP',
      destinatarios: numero,
      automatico: false,
      usuarioId,
    });
  }

  async envios(id: string): Promise<EnvioDeTrabajo[]> {
    await this.traer(id);
    return this.repo.listarEnvios(id);
  }
}
