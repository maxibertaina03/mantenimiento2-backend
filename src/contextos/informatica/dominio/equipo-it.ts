import { ErrorDatosInvalidos } from './errores';

/**
 * Un equipo de informática: una PC, una notebook, un router, una cámara.
 *
 * Este archivo tiene las reglas y nada más. No sabe guardar, no sabe de HTTP
 * y no conoce Prisma: lo que necesita del mundo —si el código ya está usado,
 * si el responsable existe— se lo pasa quien lo llama.
 *
 * Las reglas que importan son las de quién lo tiene. Un equipo está en
 * depósito o a cargo de alguien, y cada cambio de manos queda en el historial.
 * Todo lo que sigue cuida que ese historial diga la verdad.
 */

export const ESTADOS_EQUIPO_IT = [
  'EN_USO',
  'EN_DEPOSITO',
  'EN_REPARACION',
  'DADO_DE_BAJA',
] as const;
export type EstadoEquipoIt = (typeof ESTADOS_EQUIPO_IT)[number];

export type TipoDisco = 'HDD' | 'SSD' | 'NVME' | 'EMMC';
export type TipoAccesoRemoto =
  | 'NINGUNO'
  | 'ANYDESK'
  | 'TEAMVIEWER'
  | 'RDP'
  | 'VNC'
  | 'SSH'
  | 'OTRO';

/** Lo mínimo que las reglas necesitan saber de un equipo. */
export interface EstadoDeTenencia {
  estado: EstadoEquipoIt;
  /** Quién lo tiene. `null` es depósito. */
  responsableId: string | null;
}

/**
 * Con qué estado nace un equipo.
 *
 * Si se da de alta ya a cargo de alguien, está en uso; si no, en depósito. El
 * estado que se pida explícitamente manda, salvo la regla de la baja.
 */
export function estadoInicial(
  pedido: EstadoEquipoIt | undefined,
  responsableId: string | null | undefined,
): EstadoEquipoIt {
  const estado = pedido ?? (responsableId ? 'EN_USO' : 'EN_DEPOSITO');
  validarBajaSinTenedor(estado, responsableId);
  return estado;
}

/**
 * Un equipo dado de baja no puede estar en manos de nadie.
 *
 * Si se permitiera, el historial diría que alguien tiene una máquina que ya no
 * existe, y el día que se la reclamen no hay forma de saber qué pasó.
 */
export function validarBajaSinTenedor(
  estado: EstadoEquipoIt,
  responsableId: string | null | undefined,
): void {
  if (estado === 'DADO_DE_BAJA' && responsableId) {
    throw new ErrorDatosInvalidos(
      'Un equipo dado de baja no puede quedar a cargo de alguien. Devolvelo a depósito primero.',
    );
  }
}

/**
 * El código interno es la etiqueta física pegada en la máquina: no se repite.
 *
 * `existente` es el equipo que ya tiene ese código, si hay uno; lo busca quien
 * llama. Al editar, chocar consigo mismo no cuenta.
 */
export function validarCodigoLibre(
  codigoInterno: string,
  existente: { id: string; nombreParaMostrar: string } | null,
  idPropio?: string,
): void {
  if (existente && existente.id !== idPropio) {
    throw new ErrorDatosInvalidos(
      `Ya existe un equipo con el código interno "${codigoInterno}" (${existente.nombreParaMostrar}).`,
    );
  }
}

/**
 * Decide si el equipo puede cambiar de manos, y en qué estado queda.
 *
 * Tres reglas:
 *
 * - Un equipo dado de baja no se asigna: primero hay que cambiarle el estado.
 * - Asignarlo a quien ya lo tiene no es un movimiento. Si se aceptara, el
 *   historial sumaría un tramo nuevo sin que nada haya cambiado de mano.
 * - Entregarlo lo pone EN USO; devolverlo, EN DEPÓSITO.
 */
export function decidirAsignacion(
  equipo: EstadoDeTenencia,
  nuevoResponsableId: string | null,
): EstadoEquipoIt {
  if (equipo.estado === 'DADO_DE_BAJA') {
    throw new ErrorDatosInvalidos(
      'El equipo está dado de baja: no se puede asignar. Cambiá su estado primero.',
    );
  }

  if (equipo.responsableId === nuevoResponsableId) {
    throw new ErrorDatosInvalidos(
      nuevoResponsableId
        ? 'El equipo ya está a cargo de esa persona.'
        : 'El equipo ya está en depósito.',
    );
  }

  return nuevoResponsableId ? 'EN_USO' : 'EN_DEPOSITO';
}

/**
 * Un equipo a cargo de alguien no se borra.
 *
 * Borrarlo se llevaría el historial de quién lo tuvo, y ese historial es
 * justamente lo que hace falta el día que el equipo no aparece.
 */
export function validarEliminable(equipo: EstadoDeTenencia): void {
  if (equipo.responsableId) {
    throw new ErrorDatosInvalidos(
      'No se puede eliminar un equipo que está a cargo de alguien. Devolvelo a depósito primero.',
    );
  }
}

/**
 * Cómo se nombra un equipo en un mensaje.
 *
 * Marca y modelo pueden faltar: en el inventario real 28 de 65 equipos no
 * tienen marca. Cuando faltan, se dice.
 */
export function nombreParaMostrar(marca: string | null, modelo: string | null): string {
  return [marca, modelo].filter(Boolean).join(' ') || 'sin marca cargada';
}

/** La garantía vencida se calcula acá, para que la pantalla no repita la regla. */
export function garantiaVencida(garantiaHasta: Date | null, hoy: Date): boolean {
  return garantiaHasta ? garantiaHasta.getTime() < hoy.getTime() : false;
}
