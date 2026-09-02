/**
 * De dónde sale "ahora".
 *
 * Parece una exageración envolver `new Date()`, y no lo es: la funcionalidad
 * central de este contexto es "avisar una semana antes del service". Si el
 * código le pregunta la hora al sistema operativo, esa regla solo se puede
 * probar esperando a que llegue la fecha, o falseando el reloj global — que
 * afecta a todos los tests que corran en paralelo.
 *
 * Con esto, el test dice "hoy es 1 de septiembre" y verifica exactamente qué
 * avisos salen, incluidos los bordes.
 */
export interface Reloj {
  ahora(): Date;
}

export const RELOJ = Symbol('Reloj');

/** El de producción. */
export class RelojDelSistema implements Reloj {
  ahora(): Date {
    return new Date();
  }
}

/** El de los tests: la fecha la decide quien prueba. */
export class RelojFijo implements Reloj {
  constructor(private fecha: Date) {}

  ahora(): Date {
    return this.fecha;
  }

  mover(fecha: Date): void {
    this.fecha = fecha;
  }
}
