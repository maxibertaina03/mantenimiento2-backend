/**
 * Lo único que los equipos necesitan saber de los responsables: si existen.
 *
 * Los responsables son un catálogo aparte —gente que tiene equipos, con o sin
 * cuenta en el sistema— y se administran en su propio módulo. Este puerto es
 * la puerta angosta por la que el contexto les pregunta, sin conocer cómo se
 * guardan.
 */
export interface ConsultaResponsables {
  existe(responsableId: string): Promise<boolean>;
}

export const CONSULTA_RESPONSABLES = Symbol('ConsultaResponsables');
