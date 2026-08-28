import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface AdjuntoCorreo {
  nombre: string;
  /** Contenido del archivo. */
  contenido: Buffer;
  tipo: string;
}

/**
 * Traduce el error crudo del envío a algo accionable.
 *
 * Los códigos de nodemailer no le dicen nada a quien está usando el sistema, y
 * cada uno se arregla de una forma distinta: no es lo mismo una contraseña mal
 * copiada que un puerto bloqueado por el hosting.
 */
export function explicarErrorSmtp(error: unknown): string {
  const e = error as { code?: string; responseCode?: number; message?: string };
  const codigo = e?.code ?? '';
  const mensaje = e?.message ?? String(error);

  if (codigo === 'ETIMEDOUT' || codigo === 'ECONNECTION' || codigo === 'ESOCKET') {
    return (
      'no se pudo conectar con el servidor de correo. El hosting bloquea el ' +
      'puerto SMTP saliente, así que hay que enviar por API HTTP: configurá ' +
      `BREVO_API_KEY. (${codigo}: ${mensaje})`
    );
  }
  if (codigo === 'EAUTH' || e?.responseCode === 535) {
    return (
      'Gmail rechazó las credenciales. Revisá que SMTP_PASS sea la contraseña de ' +
      'aplicación de 16 caracteres (sin espacios) y no la clave de la cuenta, y que ' +
      `SMTP_USER sea la casilla que la generó. (${mensaje})`
    );
  }
  if (codigo === 'EENVELOPE') {
    return `alguna dirección de correo es inválida. (${mensaje})`;
  }
  if (e?.responseCode === 550 || e?.responseCode === 552) {
    return `el servidor rechazó el mensaje, puede ser por el tamaño del adjunto. (${mensaje})`;
  }
  return mensaje;
}

export interface MensajeCorreo {
  para: string[];
  copia?: string[];
  /** A dónde contesta el proveedor si le da "Responder". */
  responderA?: string;
  /** Nombre que se muestra como remitente, antes de la casilla. */
  nombreRemitente?: string;
  asunto: string;
  texto: string;
  adjuntos?: AdjuntoCorreo[];
}

/** Cómo se está mandando el correo. */
export type ViaEnvio = 'brevo' | 'smtp' | 'ninguna';

/**
 * Envío de correo, por API HTTP (Brevo) o por SMTP.
 *
 * La vía HTTP existe porque **Render bloquea los puertos SMTP salientes**: con
 * SMTP la conexión se queda esperando hasta el timeout y no sale ningún correo.
 * Una API sobre HTTPS no se puede bloquear sin romper todo lo demás.
 *
 * Se elige por variables de entorno, sin tocar código: si hay BREVO_API_KEY va
 * por HTTP; si no, cae a SMTP (que sirve en local, donde nada está bloqueado).
 * Si no hay ninguna, el servicio queda apagado y la app sigue funcionando con
 * el envío manual.
 *
 * Todas las órdenes salen de UNA casilla (MAIL_FROM). El correo del usuario va
 * en `Reply-To`: el proveedor le contesta a la persona, aunque el remitente sea
 * la casilla del sistema.
 */
@Injectable()
export class CorreoService {
  private readonly logger = new Logger(CorreoService.name);
  private readonly via: ViaEnvio;
  private readonly remitente: string;
  private readonly claveBrevo: string | undefined;
  private transporte: Transporter | null = null;

  /** Si Brevo no contesta en este tiempo, se corta con un error claro. */
  private static readonly TIMEOUT_HTTP_MS = 20_000;

  constructor(private readonly config: ConfigService) {
    this.claveBrevo = this.config.get<string>('BREVO_API_KEY');
    const host = this.config.get<string>('SMTP_HOST');
    const usuario = this.config.get<string>('SMTP_USER');
    const clave = this.config.get<string>('SMTP_PASS');
    this.remitente = this.config.get<string>('MAIL_FROM') ?? usuario ?? '';

    if (this.claveBrevo) {
      this.via = 'brevo';
      this.logger.log(`Correo por API de Brevo, desde ${this.remitente}`);
      return;
    }

    if (host && usuario && clave) {
      this.via = 'smtp';
      // 587 con STARTTLS es lo que usa Gmail. `secure` solo va en el 465.
      const puerto = Number(this.config.get<string>('SMTP_PORT') ?? 587);
      this.transporte = nodemailer.createTransport({
        host,
        port: puerto,
        secure: puerto === 465,
        auth: { user: usuario, pass: clave },

        // Timeouts cortos y explícitos. Los de nodemailer son de 2 minutos para
        // conectar: con el puerto bloqueado, la pantalla queda congelada todo
        // ese rato sin mostrar ni un error.
        connectionTimeout: 15_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
      });
      this.logger.log(`Correo por SMTP (${host}:${puerto}), desde ${this.remitente}`);
      return;
    }

    this.via = 'ninguna';
    this.logger.warn(
      'Correo no configurado (falta BREVO_API_KEY, o SMTP_HOST/SMTP_USER/SMTP_PASS). ' +
        'El envío automático de órdenes queda deshabilitado; el sistema sigue ' +
        'ofreciendo el envío manual.',
    );
  }

  estaConfigurado(): boolean {
    return this.via !== 'ninguna';
  }

  viaDeEnvio(): ViaEnvio {
    return this.via;
  }

  /**
   * Comprueba que las credenciales sirvan y que se pueda salir a la red.
   *
   * Vale la pena por separado: el hosting puede bloquear la salida, y sin esto
   * el problema recién aparecería al intentar mandar una orden real.
   */
  async verificar(): Promise<{ ok: boolean; detalle: string }> {
    if (this.via === 'ninguna') return { ok: false, detalle: 'Correo no configurado' };

    try {
      if (this.via === 'brevo') {
        // /account es de solo lectura: valida la clave sin mandar nada.
        const respuesta = await this.pedirABrevo('https://api.brevo.com/v3/account', 'GET');
        if (!respuesta.ok) {
          return { ok: false, detalle: `Brevo respondió ${respuesta.status}: ${respuesta.cuerpo}` };
        }
        return { ok: true, detalle: `Brevo conectado, enviando desde ${this.remitente}` };
      }

      await this.transporte!.verify();
      return { ok: true, detalle: `SMTP conectado como ${this.remitente}` };
    } catch (error) {
      const detalle = explicarErrorSmtp(error);
      this.logger.error(`El correo no responde: ${detalle}`);
      return { ok: false, detalle };
    }
  }

  async enviar(mensaje: MensajeCorreo): Promise<void> {
    if (this.via === 'ninguna') throw new Error('Correo no configurado');
    if (this.via === 'brevo') return this.enviarPorBrevo(mensaje);
    return this.enviarPorSmtp(mensaje);
  }

  /** Llamada a Brevo con timeout: sin él, una API colgada cuelga la pantalla. */
  private async pedirABrevo(
    url: string,
    metodo: 'GET' | 'POST',
    cuerpo?: unknown,
  ): Promise<{ ok: boolean; status: number; cuerpo: string }> {
    const corte = AbortSignal.timeout(CorreoService.TIMEOUT_HTTP_MS);
    const respuesta = await fetch(url, {
      method: metodo,
      headers: {
        'api-key': this.claveBrevo!,
        accept: 'application/json',
        ...(cuerpo ? { 'content-type': 'application/json' } : {}),
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: corte,
    });
    return { ok: respuesta.ok, status: respuesta.status, cuerpo: await respuesta.text() };
  }

  private async enviarPorBrevo(mensaje: MensajeCorreo): Promise<void> {
    const cuerpo = {
      sender: {
        email: this.remitente,
        ...(mensaje.nombreRemitente ? { name: mensaje.nombreRemitente } : {}),
      },
      to: mensaje.para.map((email) => ({ email })),
      ...(mensaje.copia?.length ? { cc: mensaje.copia.map((email) => ({ email })) } : {}),
      ...(mensaje.responderA ? { replyTo: { email: mensaje.responderA } } : {}),
      subject: mensaje.asunto,
      textContent: mensaje.texto,
      ...(mensaje.adjuntos?.length
        ? {
            attachment: mensaje.adjuntos.map((a) => ({
              name: a.nombre,
              content: a.contenido.toString('base64'),
            })),
          }
        : {}),
    };

    const respuesta = await this.pedirABrevo('https://api.brevo.com/v3/smtp/email', 'POST', cuerpo);
    if (!respuesta.ok) {
      // El cuerpo del error de Brevo dice exactamente qué está mal (remitente
      // sin verificar, clave inválida, cuota agotada), y es justo lo que hace
      // falta para arreglarlo.
      throw new Error(`Brevo respondió ${respuesta.status}: ${respuesta.cuerpo}`);
    }
  }

  private async enviarPorSmtp(mensaje: MensajeCorreo): Promise<void> {
    const from = mensaje.nombreRemitente
      ? `"${mensaje.nombreRemitente}" <${this.remitente}>`
      : this.remitente;

    await this.transporte!.sendMail({
      from,
      to: mensaje.para,
      cc: mensaje.copia?.length ? mensaje.copia : undefined,
      replyTo: mensaje.responderA,
      subject: mensaje.asunto,
      text: mensaje.texto,
      attachments: mensaje.adjuntos?.map((a) => ({
        filename: a.nombre,
        content: a.contenido,
        contentType: a.tipo,
      })),
    });
  }
}
