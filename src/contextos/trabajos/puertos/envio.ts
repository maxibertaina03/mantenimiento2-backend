/**
 * Lo que hace falta para mandarle una orden a un taller de afuera: a quién
 * (el contacto del proveedor) y por dónde (la casilla de la empresa).
 *
 * Son de este contexto y no importados de compras, que tiene unos parecidos:
 * si compras cambia cómo manda sus órdenes, las de trabajo no tienen por qué
 * enterarse.
 */

export interface CorreoAlTaller {
  para: string[];
  responderA?: string;
  nombreRemitente: string;
  asunto: string;
  texto: string;
  adjuntos: { nombre: string; contenido: Buffer; tipo: string }[];
}

export interface CorreoTrabajos {
  estaConfigurado(): boolean;
  enviar(correo: CorreoAlTaller): Promise<void>;
  /** El motivo real de un rechazo del servidor de correo, legible. */
  explicarError(error: unknown): string;
}

export const CORREO_TRABAJOS = Symbol('CorreoTrabajos');

export interface ContactoDelTaller {
  nombre: string;
  email: string | null;
  telefono: string | null;
}

/** El catálogo de proveedores, visto desde trabajos: solo el contacto. */
export interface ContactosDeTalleres {
  contacto(proveedorId: string): Promise<ContactoDelTaller | null>;
}

export const CONTACTOS_DE_TALLERES = Symbol('ContactosDeTalleres');
