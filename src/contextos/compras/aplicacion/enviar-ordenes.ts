import {
  ErrorCorreoNoConfigurado,
  ErrorDatosInvalidos,
  ErrorEnvioFallido,
  ErrorNoEncontrado,
  ErrorSinDestinatario,
} from '../dominio/errores';
import type { EstadoOrdenCompra } from '../dominio/orden-compra';
import {
  OrdenParaMensaje,
  armarMensaje,
  destinatarios,
  esEmailValido,
} from '../dominio/mensaje-orden';
import { Casillas, Correo } from '../puertos/envio';
import {
  EnvioConUsuario,
  OrdenConRelaciones,
  RepositorioOrdenesCompra,
} from '../puertos/repositorio-ordenes-compra';

/** Quién manda la orden: el proveedor le contesta a esa persona. */
export interface QuienEnvia {
  id: string;
  nombre?: string | null;
  email?: string | null;
}

export interface ResultadoEnvio {
  para: string[];
  copia: string[];
  responderA: string | null;
  estado: EstadoOrdenCompra;
}

/**
 * Cómo le llega la orden al proveedor: por correo, o por WhatsApp.
 *
 * `vista` es la forma en que el proveedor ve la orden —nombres, total—, la
 * misma que muestra la pantalla. Se recibe armada para que el correo diga
 * exactamente lo mismo que el PDF que va adjunto.
 */
export class EnviarOrdenes {
  constructor(
    private readonly repo: RepositorioOrdenesCompra,
    private readonly correo: Correo,
    private readonly casillas: Casillas,
    private readonly vista: (orden: OrdenConRelaciones) => OrdenParaMensaje,
  ) {}

  private async traer(id: string): Promise<OrdenConRelaciones> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) throw new ErrorNoEncontrado(`No existe la orden de compra con id ${id}`);
    return orden;
  }

  /**
   * Manda la orden por correo, con el PDF adjunto.
   *
   * Quien llama aporta SOLO el PDF: el texto y los destinatarios se arman acá
   * con los datos guardados. Si pudiera elegir a quién se le manda, cualquiera
   * con una sesión podría usar la casilla de la empresa para escribirle a
   * quien quisiera.
   */
  async porCorreo(id: string, pdf: Buffer, quien?: QuienEnvia): Promise<ResultadoEnvio> {
    if (!this.correo.estaConfigurado()) {
      throw new ErrorCorreoNoConfigurado(
        'El envío automático de correo no está configurado. ' +
          'Podés enviar la orden manualmente desde el sistema.',
      );
    }

    const orden = this.vista(await this.traer(id));
    const { para, copia } = destinatarios(orden, this.casillas.mailAdministracion());

    // Un proveedor sin correo y sin copia interna configurada no deja a dónde
    // mandar. Mandar un correo sin destinatario no falla: simplemente no le
    // llega a nadie, y la orden quedaría marcada como enviada.
    if (para.length === 0) {
      throw new ErrorSinDestinatario(
        `${orden.proveedorNombre ?? 'El proveedor'} no tiene correo cargado, y no hay una ` +
          'casilla interna configurada para recibir la copia. Cargale el correo desde esta ' +
          'misma pantalla, o mandale la orden por WhatsApp.',
      );
    }
    const { asunto, cuerpo } = armarMensaje(orden);

    // El correo del usuario va en Reply-To: el remitente es la casilla del
    // sistema, pero el proveedor le contesta a la persona que hizo la orden.
    const responderA = esEmailValido(quien?.email) ? quien!.email! : undefined;

    if (pdf.length === 0) {
      throw new ErrorDatosInvalidos('El PDF adjunto vino vacío.');
    }

    try {
      await this.correo.enviar({
        para,
        copia,
        responderA,
        nombreRemitente: quien?.nombre
          ? `${quien.nombre} · Lácteos Las Tres S.R.L.`
          : 'Lácteos Las Tres S.R.L.',
        asunto,
        texto: cuerpo,
        adjuntos: [{ nombre: `${orden.numero}.pdf`, contenido: pdf, tipo: 'application/pdf' }],
      });
    } catch (error) {
      // El motivo real (credenciales rechazadas, puerto bloqueado, límite de
      // envíos) se pierde si esto sale como un error genérico, y es justo lo
      // que hace falta para saber qué corregir. No expone credenciales: el
      // mensaje del servidor de correo no las incluye.
      throw new ErrorEnvioFallido(
        `No se pudo enviar el correo: ${this.correo.explicarError(error)} ` +
          'La orden no cambió de estado; podés reintentar o mandarla a mano.',
      );
    }

    // Se registra DESPUES de que el correo salio. Al reves, un fallo de Brevo
    // dejaria constancia de un envio que nunca ocurrio, y "ya se la mandamos"
    // pasaria a ser mentira justo cuando alguien lo consulta.
    //
    // Emitir va junto: una orden que ya salio no puede seguir editandose, o el
    // proveedor termina con un PDF que no coincide con lo que dice el sistema.
    const actualizada = await this.repo.registrarEnvio({
      ordenId: id,
      via: 'CORREO',
      destinatarios: [...para, ...copia].join(', '),
      automatico: true,
      usuarioId: quien?.id ?? null,
    });

    return { para, copia, responderA: responderA ?? null, estado: actualizada.estado };
  }

  /**
   * Deja constancia de que la orden se mando por WhatsApp.
   *
   * WhatsApp no sale solo: el sistema abre el chat con el texto escrito y la
   * persona toca enviar y adjunta el PDF. Por eso se registra `automatico:
   * false`, y por eso lo llama el frontend cuando la persona abre el chat, no
   * cuando WhatsApp confirma nada.
   *
   * Es deliberadamente optimista: si alguien abre el chat y despues no manda,
   * queda un envio registrado de mas. Lo contrario —no registrar nada— deja la
   * orden en BORRADOR y editable despues de que el proveedor la recibio, que es
   * bastante peor.
   */
  async porWhatsapp(id: string, numero: string, usuarioId: string | null) {
    await this.traer(id);
    return this.repo.registrarEnvio({
      ordenId: id,
      via: 'WHATSAPP',
      destinatarios: numero,
      automatico: false,
      usuarioId,
    });
  }

  /** Por dónde y cuándo salió esta orden. */
  async envios(id: string): Promise<EnvioConUsuario[]> {
    await this.traer(id);
    return this.repo.listarEnvios(id);
  }

  /**
   * Los datos fijos de la empresa que la pantalla de envío necesita.
   *
   * Salen del servidor y no de una constante en el frontend: el día que
   * cambien se cambian en un solo lugar.
   */
  configuracion() {
    return {
      mailAdministracion: this.casillas.mailAdministracion(),
      whatsappAdministracion: this.casillas.whatsappAdministracion(),
      correoConfigurado: this.correo.estaConfigurado(),
    };
  }
}
