import { EstadoEquipo } from '../dominio/estado-equipo';
import { TramoDeMontaje } from '../dominio/montaje';

/** Un tramo de montaje, con los nombres para mostrarlo. */
export interface Montaje extends TramoDeMontaje {
  id: string;
  componenteNombre: string;
  equipoPadreNombre: string;
  motivo: string | null;
  registradoPorNombre: string | null;
}

/** Un componente montado en una máquina, tal como se lista en su ficha. */
export interface Componente {
  id: string;
  nombre: string;
  estado: EstadoEquipo;
  tipoNombre: string | null;
  clasificacion: string;
  /** Desde cuándo está montado ahí. */
  montadoDesde: Date | null;
  cantidadComponentes: number;
}

export interface RepositorioMontajes {
  /**
   * Monta el componente en la máquina. Si ya estaba montado en otra, cierra
   * ese tramo en el mismo momento: es un traslado. Todo o nada.
   */
  montar(datos: {
    componenteId: string;
    equipoPadreId: string;
    cuando: Date;
    motivo: string | null;
    registradoPorId: string | null;
  }): Promise<void>;

  /** Cierra el tramo abierto y deja el componente suelto. Todo o nada. */
  desmontar(datos: { componenteId: string; cuando: Date; motivo: string | null }): Promise<void>;

  /** Los equipos montados en esta máquina, en el primer nivel. */
  componentes(equipoPadreId: string): Promise<Componente[]>;

  /** Por dónde pasó este componente, del tramo más nuevo al más viejo. */
  tramosDelComponente(componenteId: string): Promise<Montaje[]>;

  /**
   * Las máquinas donde está montado este equipo, subiendo nivel por nivel:
   * la de arriba, la de arriba de esa, etc.
   */
  antecesores(equipoId: string): Promise<string[]>;
}

export const REPOSITORIO_MONTAJES = Symbol('RepositorioMontajes');
