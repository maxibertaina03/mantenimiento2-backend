/**
 * De dónde sale "ahora".
 *
 * Se pide por un puerto para poder probar "faltan tres días" sin esperar tres
 * días, y para que dos partes de la misma operación usen exactamente el mismo
 * instante.
 */
export interface Reloj {
  ahora(): Date;
}

export const RELOJ_INFORMATICA = Symbol('RelojInformatica');
