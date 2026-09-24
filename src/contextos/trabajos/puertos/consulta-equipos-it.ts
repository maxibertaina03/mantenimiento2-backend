/**
 * Lo único que este contexto sabe de un equipo de informática.
 *
 * Es la misma capa anticorrupción que `ConsultaEquipos` —ver el porqué ahí— pero
 * contra la otra tabla. Son dos puertos y no uno con un parámetro "tipo" porque
 * son dos tablas distintas: el día que una cambie, el otro puerto no se entera.
 *
 * Ojo con el nombre: un equipo de informática NO tiene columna `nombre`. Se
 * arma con marca y modelo, y si faltan, con el código interno pegado en la
 * máquina. El adaptador es el que sabe armarlo.
 */
export interface EquipoItReferenciado {
  id: string;
  nombre: string;
  codigo: string | null;
}

export interface ConsultaEquiposIt {
  buscarPorId(id: string): Promise<EquipoItReferenciado | null>;
}

export const CONSULTA_EQUIPOS_IT = Symbol('ConsultaEquiposIt');
