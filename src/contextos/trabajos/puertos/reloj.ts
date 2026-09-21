/**
 * De dónde sale "ahora" para este contexto.
 *
 * Está declarado acá y no importado del contexto de equipos, que tiene uno
 * igual, porque dos contextos que comparten un puerto quedan atados por él: el
 * día que uno necesite un reloj con huso horario, el cambio le llega al otro
 * sin pedirlo. Es una interfaz de un método; el costo de repetirla es menor que
 * el de acoplarlos.
 *
 * Existe, en vez de llamar a `new Date()` donde haga falta, para que los tests
 * puedan fijar la fecha sin falsear el reloj global, que afecta a todos los
 * tests que corran en paralelo.
 */
export interface Reloj {
  ahora(): Date;
}

export const RELOJ_TRABAJOS = Symbol('RelojTrabajos');

/** El de producción. */
export class RelojDelSistema implements Reloj {
  ahora(): Date {
    return new Date();
  }
}
