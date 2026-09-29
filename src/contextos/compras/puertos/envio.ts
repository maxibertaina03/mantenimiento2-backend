/**
 * Por dónde sale una orden: la casilla de correo de la empresa, y los datos
 * fijos de administración que se configuran en el servidor.
 */

export interface CorreoSaliente {
  para: string[];
  copia: string[];
  responderA?: string;
  nombreRemitente: string;
  asunto: string;
  texto: string;
  adjuntos: { nombre: string; contenido: Buffer; tipo: string }[];
}

export interface Correo {
  estaConfigurado(): boolean;
  enviar(correo: CorreoSaliente): Promise<void>;
  /** El motivo real de un rechazo del servidor de correo, legible. */
  explicarError(error: unknown): string;
}

export interface Casillas {
  /** La casilla que recibe copia de cada orden, o null si no hay ninguna. */
  mailAdministracion(): string | null;
  whatsappAdministracion(): string | null;
}

/** La hora de ahora, por un puerto para que las pruebas puedan fijarla. */
export interface Reloj {
  ahora(): Date;
}

export const relojDelSistema: Reloj = { ahora: () => new Date() };
