import { ErrorDatosInvalidos, ErrorTransicionInvalida } from './errores';
import { EstadoEquipo } from './estado-equipo';

/**
 * Las reglas de montar un equipo dentro de otro.
 *
 * La electrobomba va en la desnatadora: la bomba es un componente y la
 * desnatadora, la máquina donde está montada. Un equipo está montado en UNA
 * sola máquina a la vez, una máquina puede tener muchos componentes, y se
 * puede anidar: desnatadora → bomba → motor.
 */

/** Lo que hace falta saber de cada equipo para decidir. */
export interface EquipoParaMontar {
  id: string;
  nombre: string;
  estado: EstadoEquipo;
  /** Dónde está montado hoy, o null. */
  equipoPadreId: string | null;
}

/**
 * Comprueba que `componente` se pueda montar en `maquina`.
 *
 * `antecesoresDeLaMaquina` son los ids de las máquinas donde está montada
 * `maquina`, subiendo nivel por nivel hasta el equipo que va suelto. Si el
 * componente aparece ahí, montarlo cerraría un círculo: la bomba adentro del
 * motor que está adentro de la bomba. Una vuelta así hace que no haya forma de
 * decir cuál es la máquina de arriba, y cualquier recorrido del árbol no
 * terminaría nunca.
 */
export function validarMontaje(
  componente: EquipoParaMontar,
  maquina: EquipoParaMontar,
  antecesoresDeLaMaquina: string[],
): void {
  if (componente.id === maquina.id) {
    throw new ErrorDatosInvalidos('Un equipo no se puede montar dentro de sí mismo.');
  }
  if (antecesoresDeLaMaquina.includes(componente.id)) {
    throw new ErrorDatosInvalidos(
      `«${maquina.nombre}» ya está montado dentro de «${componente.nombre}», directa o ` +
        'indirectamente. Montarlo al revés dejaría a cada uno adentro del otro.',
    );
  }
  if (componente.estado === 'DADO_DE_BAJA') {
    throw new ErrorTransicionInvalida(
      `«${componente.nombre}» está dado de baja: no se puede montar en ninguna máquina.`,
    );
  }
  if (maquina.estado === 'DADO_DE_BAJA') {
    throw new ErrorTransicionInvalida(
      `«${maquina.nombre}» está dada de baja: no se le pueden montar componentes.`,
    );
  }
  if (componente.equipoPadreId === maquina.id) {
    throw new ErrorDatosInvalidos(`«${componente.nombre}» ya está montado en «${maquina.nombre}».`);
  }
}

/** Para desmontar, tiene que estar montado en algún lado. */
export function validarDesmontaje(componente: EquipoParaMontar): void {
  if (!componente.equipoPadreId) {
    throw new ErrorDatosInvalidos(`«${componente.nombre}» no está montado en ninguna máquina.`);
  }
}

/** Un tramo de montaje: dónde estuvo un componente y entre qué fechas. */
export interface TramoDeMontaje {
  componenteId: string;
  equipoPadreId: string;
  desde: Date;
  /** null mientras sigue montado ahí. */
  hasta: Date | null;
}

/** Si algo que pasó en `fecha` le pasó al componente mientras estaba en ese tramo. */
export function ocurrioDuranteElTramo(tramo: TramoDeMontaje, fecha: Date): boolean {
  return fecha >= tramo.desde && (tramo.hasta === null || fecha < tramo.hasta);
}
