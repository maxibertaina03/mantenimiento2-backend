/**
 * Lo único que este contexto sabe de un equipo: que existe y cómo se llama.
 *
 * Es una capa anticorrupción, y el nombre suena más grande de lo que es. La
 * orden de trabajo necesita verificar que el equipo que le mandan es real, para
 * no quedarse con un id inventado que después no apunta a nada. Podría importar
 * el repositorio del contexto de equipos y listo, pero entonces heredaría su
 * modelo entero —estados, planes, fotos, ubicaciones— y los dos contextos
 * dejarían de poder cambiar por separado.
 *
 * Con esto, el día que el equipo cambie por dentro, acá no se entera nadie
 * mientras siga teniendo id y nombre.
 */
export interface EquipoReferenciado {
  id: string;
  nombre: string;
  codigo: string | null;
}

/**
 * Un componente montado en la máquina, y el lapso en que estuvo ahí.
 *
 * Es lo que permite que el historial de la desnatadora incluya lo que se le
 * hizo a su electrobomba, pero solo mientras la bomba estaba montada en ella:
 * lo de antes o lo de después es de otra máquina.
 */
export interface VentanaDeComponente {
  equipoId: string;
  desde: Date;
  /** null mientras sigue montado. */
  hasta: Date | null;
}

export interface ConsultaEquipos {
  buscarPorId(id: string): Promise<EquipoReferenciado | null>;
  /** Los componentes de todos los niveles, cada uno con su lapso dentro de esta máquina. */
  ventanasDeComponentes(equipoId: string): Promise<VentanaDeComponente[]>;
}

export const CONSULTA_EQUIPOS = Symbol('ConsultaEquipos');
