/**
 * A quién le llegan los avisos de mantenimiento.
 *
 * Es un puerto porque cruza al contexto de identidad: Equipos no consulta la
 * tabla de usuarios, le pide a esta interfaz las direcciones. Si mañana los
 * destinatarios salen de otro lado —un grupo, una lista de distribución— se
 * cambia el adaptador y el resto del contexto ni se entera.
 */
export interface DestinatariosAvisos {
  /**
   * Las direcciones que tienen que recibir el aviso.
   *
   * Incluye la casilla fija de la configuración y los usuarios con acceso al
   * módulo. Filtra las direcciones que no sirven: de los 35 usuarios cargados,
   * 31 tienen correos sintéticos `@sin-acceso.local` que creó la importación
   * de equipos IT para personas sin login.
   */
  obtener(): Promise<string[]>;
}

export const DESTINATARIOS_AVISOS = Symbol('DestinatariosAvisos');
