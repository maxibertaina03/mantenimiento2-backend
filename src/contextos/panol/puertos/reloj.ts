/**
 * La hora de ahora.
 *
 * Por un puerto para que las pruebas puedan fijarla. La pone el servidor, no
 * la pantalla: un movimiento sin fecha es de cuando se registró.
 */
export interface Reloj {
  ahora(): Date;
}

export const relojDelSistema: Reloj = { ahora: () => new Date() };
