/**
 * Lo único que el baúl sabe de los equipos: si existen.
 *
 * Sin esto, un id equivocado llega hasta Postgres y vuelve como una violación
 * de clave foránea: un 500 con un texto que no le dice nada a nadie.
 */
export interface ConsultaEquiposIt {
  existe(equipoItId: string): Promise<boolean>;
}

export const CONSULTA_EQUIPOS_IT_BAUL = Symbol('ConsultaEquiposItBaul');
