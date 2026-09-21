/**
 * Lo único que este contexto sabe de una persona: que existe, cómo se llama y
 * si puede hacerse cargo de un trabajo.
 *
 * Misma idea que la consulta de equipos: una capa anticorrupción. La orden
 * necesita verificar que a quien se la asigna es alguien real y que además
 * puede trabajarla, para no dejarle el trabajo a administración, que ni ve el
 * módulo. Con esto, el día que el usuario cambie por dentro, acá no se entera
 * nadie mientras siga teniendo id y nombre.
 *
 * `puedeTrabajar` lo resuelve la implementación mirando los permisos del rol,
 * porque los permisos son una decisión de la aplicación y no de este dominio:
 * acá solo importa si esa persona puede o no, no por qué.
 */
export interface UsuarioAsignable {
  id: string;
  nombre: string;
  puedeTrabajar: boolean;
}

export interface ConsultaUsuarios {
  buscarPorId(id: string): Promise<UsuarioAsignable | null>;
  /** Los que pueden hacerse cargo de un trabajo, para el desplegable. */
  listarAsignables(): Promise<UsuarioAsignable[]>;
}

export const CONSULTA_USUARIOS = Symbol('ConsultaUsuarios');
