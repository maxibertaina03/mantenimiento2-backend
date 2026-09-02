import { ErrorTransicionInvalida } from './errores';

/**
 * En qué situación está una máquina.
 *
 * No es una etiqueta suelta: define qué se le puede hacer. Un equipo dado de
 * baja no vuelve, y uno fuera de servicio no debería aparecer en los avisos de
 * service — no tiene sentido avisar que hay que hacerle mantenimiento a algo
 * que está desafectado.
 */
export const ESTADOS_EQUIPO = [
  'OPERATIVO',
  'EN_REPARACION',
  'FUERA_DE_SERVICIO',
  'DADO_DE_BAJA',
] as const;

export type EstadoEquipo = (typeof ESTADOS_EQUIPO)[number];

export const ETIQUETA_ESTADO: Record<EstadoEquipo, string> = {
  OPERATIVO: 'Operativo',
  EN_REPARACION: 'En reparación',
  FUERA_DE_SERVICIO: 'Fuera de servicio',
  DADO_DE_BAJA: 'Dado de baja',
};

/**
 * A qué estados se puede pasar desde cada uno.
 *
 * DADO_DE_BAJA no tiene salida a propósito: es terminal. Un equipo que se
 * desguazó o se vendió no puede volver a estar operativo, y si alguien se
 * equivocó al darlo de baja, corresponde revisar por qué, no deshacerlo en
 * silencio. Si más adelante hace falta revertir una baja, que sea una
 * operación explícita y auditada, no una transición común.
 */
const TRANSICIONES: Record<EstadoEquipo, readonly EstadoEquipo[]> = {
  OPERATIVO: ['EN_REPARACION', 'FUERA_DE_SERVICIO', 'DADO_DE_BAJA'],
  EN_REPARACION: ['OPERATIVO', 'FUERA_DE_SERVICIO', 'DADO_DE_BAJA'],
  FUERA_DE_SERVICIO: ['OPERATIVO', 'EN_REPARACION', 'DADO_DE_BAJA'],
  DADO_DE_BAJA: [],
};

export function puedeTransicionar(desde: EstadoEquipo, hacia: EstadoEquipo): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

/**
 * Valida el cambio de estado y devuelve el nuevo.
 *
 * Quedarse en el mismo estado se acepta: guardar la ficha sin tocar el estado
 * no debería fallar solo porque el campo viene igual que estaba.
 */
export function transicionar(desde: EstadoEquipo, hacia: EstadoEquipo): EstadoEquipo {
  if (desde === hacia) return hacia;

  if (!puedeTransicionar(desde, hacia)) {
    const detalle =
      desde === 'DADO_DE_BAJA'
        ? 'Un equipo dado de baja no vuelve a ningún otro estado.'
        : `Desde "${ETIQUETA_ESTADO[desde]}" solo se puede pasar a: ` +
          TRANSICIONES[desde].map((e) => ETIQUETA_ESTADO[e]).join(', ') +
          '.';

    throw new ErrorTransicionInvalida(
      `No se puede pasar de "${ETIQUETA_ESTADO[desde]}" a "${ETIQUETA_ESTADO[hacia]}". ${detalle}`,
    );
  }
  return hacia;
}

/** Un equipo desafectado no genera avisos de mantenimiento. */
export function requiereMantenimiento(estado: EstadoEquipo): boolean {
  return estado === 'OPERATIVO' || estado === 'EN_REPARACION';
}
