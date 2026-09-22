/**
 * Lo único que este contexto necesita de los planes de mantenimiento.
 *
 * Un trabajo puede responder a un plan —"el aceite cada 90 días"— y cerrarlo
 * tiene que adelantar la próxima fecha. Esa cuenta vive en el contexto de
 * equipos, que es de donde son los planes, y no se copia acá: dos lugares
 * calculando la misma fecha terminan dando fechas distintas.
 *
 * Por eso este puerto es de dos métodos y ninguno devuelve un plan: la orden de
 * trabajo no sabe qué es un plan por dentro, solo que existe y que hay que
 * avisarle.
 */
/** Un service que vence, para ponerlo en el calendario. */
export interface VencimientoDePlan {
  planId: string;
  equipoId: string;
  /** Lo que hay que hacer, tal como lo nombraron en el plan. */
  nombre: string;
  tareas: string | null;
  fecha: Date;
}

export interface PlanesDeMantenimiento {
  /**
   * Los services que vencen entre dos fechas.
   *
   * El calendario los convierte en tareas. La cuenta de cuándo vence cada uno
   * es de los planes, no de acá.
   */
  vencimientosEntre(desde: Date, hasta: Date): Promise<VencimientoDePlan[]>;

  /** Si el plan existe y es de ese equipo. */
  esDelEquipo(planId: string, equipoId: string): Promise<boolean>;

  /**
   * Avisa que el trabajo se hizo, para que corra la próxima fecha.
   *
   * Se cuenta desde la fecha real del trabajo y no desde la planificada: un
   * service que tocaba en marzo y se hizo en mayo tiene el siguiente a los
   * noventa días de mayo.
   */
  registrarTrabajo(planId: string, fechaDelTrabajo: Date): Promise<void>;
}

export const PLANES_DE_MANTENIMIENTO = Symbol('PlanesDeMantenimiento');
