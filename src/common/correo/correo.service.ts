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

/**
 * Envío de correo por SMTP (Gmail).
 *
 * Todas las órdenes salen de UNA casilla (SMTP_USER). Que salgan de la casilla
 * de cada usuario requeriría la API de Gmail con OAuth y que cada uno autorice,
 * así que en su lugar el correo del usuario va en `Reply-To`: el proveedor le
 * contesta a la persona, aunque el remitente sea la casilla del sistema.
 *
 * Si no hay SMTP configurado el servicio no falla al arrancar: queda apagado y
 * `estaConfigurado()` devuelve false, para que la app siga funcionando con el
 * envío manual.
 */
@Injectable()
export class CorreoService {
  private readonly logger = new Logger(CorreoService.name);
  private transporte: Transporter | null = null;
  private readonly remitente: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const usuario = this.config.get<string>('SMTP_USER');
    const clave = this.config.get<string>('SMTP_PASS');
    this.remitente = this.config.get<string>('MAIL_FROM') ?? usuario ?? '';

    if (!host || !usuario || !clave) {
      this.logger.warn(
        'SMTP no configurado (faltan SMTP_HOST/SMTP_USER/SMTP_PASS). ' +
          'El envío automático de órdenes queda deshabilitado; el sistema sigue ' +
          'ofreciendo el envío manual.',
      );
      return;
    }

    // 587 con STARTTLS es lo que usa Gmail. `secure` solo va en el 465.
    const puerto = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    this.transporte = nodemailer.createTransport({
      host,
      port: puerto,
      secure: puerto === 465,
      auth: { user: usuario, pass: clave },
    });
  }

  estaConfigurado(): boolean {
    return this.transporte !== null;
  }

  /**
   * Comprueba que las credenciales sirvan y que el puerto no esté bloqueado.
   *
   * Vale la pena por separado: algunos hostings bloquean los puertos SMTP
   * salientes, y sin esto el problema recién aparecería al intentar enviar.
   */
  async verificar(): Promise<{ ok: boolean; detalle: string }> {
    if (!this.transporte) return { ok: false, detalle: 'SMTP no configurado' };
    try {
      await this.transporte.verify();
      return { ok: true, detalle: `Conectado como ${this.remitente}` };
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      this.logger.error(`SMTP no responde: ${detalle}`);
      return { ok: false, detalle };
    }
  }

  async enviar(mensaje: MensajeCorreo): Promise<void> {
    if (!this.transporte) {
      throw new Error('SMTP no configurado');
    }

    const from = mensaje.nombreRemitente
      ? `"${mensaje.nombreRemitente}" <${this.remitente}>`
      : this.remitente;

    await this.transporte.sendMail({
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
