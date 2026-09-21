import { ErrorDatosInvalidos, ErrorNoEsSuyo, ErrorTransicionInvalida } from './errores';

/**
 * La orden de trabajo: para qué se usó lo que salió del pañol.
 *
 * Hoy una salida por trabajo es una fila de stock con una nota suelta, y ahí se
 * termina el rastro. Nadie puede contestar "¿cuánto nos costó en repuestos
 * arreglar la bomba 7 este año?" ni "¿en qué se fueron los 10 metros de
 * manguera?". La orden es el lugar donde esas dos preguntas se cruzan: agrupa
 * el trabajo, lo que se usó y, cuando se sabe, sobre qué máquina.
 *
 * El equipo es OPCIONAL y esa es una decisión de diseño, no una concesión. Hay
 * trabajos que no son sobre una máquina —arreglar una cañería, un portón, una
 * instalación nueva— y obligar a elegir un equipo haría que se cargue
 * cualquiera con tal de poder guardar. Un dato inventado es peor que uno
 * ausente: el ausente se ve, el inventado ensucia el historial de esa máquina.
 */

/** Estados por los que pasa una orden. */
export const ESTADOS_ORDEN_TRABAJO = ['ABIERTA', 'CERRADA', 'ANULADA'] as const;
export type EstadoOrdenTrabajo = (typeof ESTADOS_ORDEN_TRABAJO)[number];

export const ETIQUETA_ESTADO_TRABAJO: Record<EstadoOrdenTrabajo, string> = {
  ABIERTA: 'Abierta',
  CERRADA: 'Cerrada',
  ANULADA: 'Anulada',
};

/**
 * Qué clase de trabajo es.
 *
 * Mismo vocabulario que el historial del equipo, y a propósito: es el que
 * después contesta cuánto de lo que gastamos fue planificado y cuánto fue
 * apagar incendios. Si acá se usaran otras palabras, las dos mitades del
 * sistema no se podrían sumar.
 */
export const TIPOS_TRABAJO = ['PREVENTIVO', 'CORRECTIVO', 'MEJORA'] as const;
export type TipoTrabajo = (typeof TIPOS_TRABAJO)[number];

export const ETIQUETA_TIPO_TRABAJO: Record<TipoTrabajo, string> = {
  PREVENTIVO: 'Preventivo',
  CORRECTIVO: 'Correctivo',
  MEJORA: 'Mejora',
};

/**
 * Un material que se usó en el trabajo.
 *
 * `movimientoId` es el corazón de la trazabilidad: cargar un material acá no
 * anota un número suelto, genera la salida de stock de verdad y se queda con su
 * id. Por eso el stock del pañol y lo que dice la orden no pueden discrepar:
 * son el mismo hecho, no dos registros que hay que mantener de acuerdo.
 */
export interface MaterialUsado {
  id: string;
  ordenTrabajoId: string;
  materialId: string;
  cantidad: number;
  movimientoId: string;
  registradoPorId: string | null;
  creadoEn: Date;
}

export interface OrdenTrabajo {
  id: string;
  /** Correlativo legible: OT-2026-0001. */
  numero: string;
  /** Qué pasó, o para qué es el trabajo. */
  titulo: string;
  descripcion: string | null;
  tipo: TipoTrabajo;
  estado: EstadoOrdenTrabajo;
  /** Sobre qué máquina, cuando se sabe y quien carga puede verlas. */
  equipoId: string | null;
  abiertaEn: Date;
  abiertaPorId: string | null;
  /**
   * Quién tiene que hacer el trabajo. Nunca vacía.
   *
   * Es la pieza que convierte una lista de trabajos en un reparto: se sabe de
   * quién es cada uno, y el que no es tuyo lo ves pero no lo tocas. Que sea
   * obligatoria no es rigor por el rigor mismo: una orden sin dueño es una que
   * nadie puede cerrar y que todos suponen que va a hacer otro.
   */
  asignadoAId: string;
  /** Qué se hizo finalmente. Obligatoria para cerrar. */
  resolucion: string | null;
  cerradaEn: Date | null;
  cerradaPorId: string | null;
  motivoAnulacion: string | null;
  creadoEn: Date;
}

export interface DatosNuevaOrdenTrabajo {
  titulo: string;
  descripcion?: string | null;
  tipo: TipoTrabajo;
  equipoId?: string | null;
  abiertaPorId?: string | null;
  /** A quién se le asigna. Si no viene, queda para quien la abre. */
  asignadoAId?: string | null;
}

/** Deja el texto en una sola línea de espacios simples, o `null` si quedó vacío. */
function limpiar(texto: string | null | undefined): string | null {
  const limpio = (texto ?? '').trim().replace(/\s+/g, ' ');
  return limpio === '' ? null : limpio;
}

/**
 * Arma una orden de trabajo válida, lista para guardar.
 *
 * Recibe `ahora` en vez de preguntarlo para que los tests puedan fijar la
 * fecha, igual que en el resto del sistema.
 */
export function crearOrdenTrabajo(
  datos: DatosNuevaOrdenTrabajo,
  ahora: Date,
): Omit<OrdenTrabajo, 'id' | 'numero' | 'creadoEn'> {
  const titulo = limpiar(datos.titulo);
  if (titulo === null) {
    throw new ErrorDatosInvalidos(
      'Contá para qué es el trabajo. Una orden sin título es una fila que dentro de un mes no ' +
        'le dice nada a nadie.',
    );
  }

  // Si no se eligió a nadie, queda para quien la abre. Es el caso de abrirse
  // una orden para uno mismo, que no tiene por qué costar un paso de más.
  const asignadoAId = datos.asignadoAId ?? datos.abiertaPorId ?? null;
  if (asignadoAId === null) {
    throw new ErrorDatosInvalidos(
      'Una orden de trabajo necesita dueño: elegí a quién se le asigna.',
    );
  }

  return {
    titulo,
    asignadoAId,
    descripcion: limpiar(datos.descripcion),
    tipo: datos.tipo,
    estado: 'ABIERTA',
    equipoId: datos.equipoId ?? null,
    abiertaEn: ahora,
    abiertaPorId: datos.abiertaPorId ?? null,
    resolucion: null,
    cerradaEn: null,
    cerradaPorId: null,
    motivoAnulacion: null,
  };
}

/**
 * Si el trabajo es de quien lo está queriendo hacer.
 *
 * El candado del módulo. Los demás ven la orden —saber qué está pasando en la
 * planta es de todos— pero cargarle materiales o cerrarla es solo del que la
 * tiene asignada. Sin esto, "asignada a" sería una etiqueta decorativa y dos
 * personas podrían estar cargando repuestos sobre el mismo trabajo sin saberlo.
 *
 * El administrador no queda por encima: si necesita destrabar una orden, la
 * reasigna, y entonces figura como suya. Es a propósito, para que nunca haya
 * una orden cerrada por alguien que nunca la tuvo a cargo.
 */
export function validarQueEsSuyo(orden: OrdenTrabajo, usuarioId: string | null): void {
  if (usuarioId === null) {
    throw new ErrorNoEsSuyo(
      `No se sabe quién sos, así que no se puede saber si la orden ${orden.numero} es tuya.`,
    );
  }

  if (orden.asignadoAId !== usuarioId) {
    throw new ErrorNoEsSuyo(
      `La orden ${orden.numero} está asignada a otra persona. Podés verla, pero la termina ` +
        'quien la tiene a cargo. Si tiene que pasar a vos, pedí que te la reasignen.',
    );
  }
}

/**
 * Los cambios que deja reasignar una orden.
 *
 * Existe para que una orden no quede muerta cuando la persona que la tenía no
 * está: falta, se va de vacaciones o deja la empresa. Una cerrada o anulada ya
 * no es trabajo pendiente, así que no se reasigna.
 */
export function reasignarOrdenTrabajo(
  orden: OrdenTrabajo,
  nuevoAsignadoId: string,
): Pick<OrdenTrabajo, 'asignadoAId'> {
  if (orden.estado !== 'ABIERTA') {
    throw new ErrorTransicionInvalida(
      `Solo se reasigna una orden abierta. La ${orden.numero} está ` +
        `${ETIQUETA_ESTADO_TRABAJO[orden.estado].toLowerCase()}, ya no es trabajo pendiente.`,
    );
  }

  if (nuevoAsignadoId === orden.asignadoAId) {
    throw new ErrorDatosInvalidos('La orden ya está asignada a esa persona.');
  }

  return { asignadoAId: nuevoAsignadoId };
}

/**
 * Si la orden todavía admite que se le carguen o quiten materiales.
 *
 * Una orden cerrada es historia: si se le pudiera seguir moviendo el stock, el
 * costo del trabajo nunca terminaría de ser firme y el número que se mira para
 * decidir "reparar o reemplazar" cambiaría a espaldas de quien lo miró.
 */
export function validarQueAceptaMateriales(orden: OrdenTrabajo): void {
  if (orden.estado !== 'ABIERTA') {
    throw new ErrorTransicionInvalida(
      `La orden ${orden.numero} está ${ETIQUETA_ESTADO_TRABAJO[orden.estado].toLowerCase()}: ` +
        'no se le pueden cargar ni quitar materiales. Si falta algo, reabrila primero.',
    );
  }
}

/** La cantidad usada de un material. */
export function validarCantidadUsada(cantidad: number): void {
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new ErrorDatosInvalidos('La cantidad usada tiene que ser mayor que cero.');
  }
}

/** Los cambios que deja cerrar una orden. */
export function cerrarOrdenTrabajo(
  orden: OrdenTrabajo,
  resolucion: string,
  ahora: Date,
  cerradaPorId: string | null,
): Pick<OrdenTrabajo, 'estado' | 'resolucion' | 'cerradaEn' | 'cerradaPorId'> {
  if (orden.estado !== 'ABIERTA') {
    throw new ErrorTransicionInvalida(
      `La orden ${orden.numero} ya está ${ETIQUETA_ESTADO_TRABAJO[orden.estado].toLowerCase()}.`,
    );
  }

  // La razón de ser del módulo. Una orden cerrada sin decir qué se hizo deja el
  // mismo vacío que había antes: se sabe qué material salió, no para qué sirvió
  // ni si el problema quedó resuelto.
  const texto = limpiar(resolucion);
  if (texto === null) {
    throw new ErrorDatosInvalidos(
      'Contá qué se hizo antes de cerrar. Es lo que va a leer el que agarre la máquina la ' +
        'próxima vez que falle.',
    );
  }

  return { estado: 'CERRADA', resolucion: texto, cerradaEn: ahora, cerradaPorId };
}

/**
 * Los cambios que deja reabrir una orden cerrada.
 *
 * Existe porque sin esto una orden cerrada de más queda muerta para siempre, y
 * la alternativa sería que alguien la anule y cargue todo de nuevo, con el
 * stock ya movido. La resolución no se borra: es lo que se escribió, y si
 * cambia se vuelve a escribir al cerrar.
 */
export function reabrirOrdenTrabajo(
  orden: OrdenTrabajo,
): Pick<OrdenTrabajo, 'estado' | 'cerradaEn' | 'cerradaPorId'> {
  if (orden.estado !== 'CERRADA') {
    throw new ErrorTransicionInvalida(
      `Solo se puede reabrir una orden cerrada. La ${orden.numero} está ` +
        `${ETIQUETA_ESTADO_TRABAJO[orden.estado].toLowerCase()}.`,
    );
  }

  return { estado: 'ABIERTA', cerradaEn: null, cerradaPorId: null };
}

/**
 * Los cambios que deja anular una orden.
 *
 * Solo se anula una orden abierta, y solo si no movió stock. Anular una que ya
 * consumió materiales dejaría el pañol descontado sin nada que explique a dónde
 * fue: para eso están quitar el material —que devuelve el stock— y recién
 * después anular.
 */
export function anularOrdenTrabajo(
  orden: OrdenTrabajo,
  motivo: string,
  materialesCargados: number,
): Pick<OrdenTrabajo, 'estado' | 'motivoAnulacion'> {
  if (orden.estado !== 'ABIERTA') {
    throw new ErrorTransicionInvalida(
      `Solo se puede anular una orden abierta. La ${orden.numero} está ` +
        `${ETIQUETA_ESTADO_TRABAJO[orden.estado].toLowerCase()}.`,
    );
  }

  if (materialesCargados > 0) {
    throw new ErrorTransicionInvalida(
      `La orden ${orden.numero} tiene ${materialesCargados} material(es) cargados, que ya ` +
        'salieron del stock. Quitalos primero: así el stock vuelve y queda asentado que ' +
        'volvió.',
    );
  }

  const texto = limpiar(motivo);
  if (texto === null) {
    throw new ErrorDatosInvalidos('Decí por qué se anula, para que quede el motivo.');
  }

  return { estado: 'ANULADA', motivoAnulacion: texto };
}

/**
 * Si la orden se puede borrar del sistema para siempre.
 *
 * Solo una anulada y que nunca movió stock. Los dos requisitos son la misma
 * idea: lo que dejó rastro en el pañol no puede desaparecer, porque el rastro
 * quedaría huérfano. Una orden que nunca sacó nada no explica ningún movimiento,
 * así que borrarla no deja nada colgando.
 *
 * Exigir que esté anulada primero hace que borrar sean dos pasos y no uno. El
 * primero pide el motivo, así que si alguien se arrepiente a mitad de camino
 * queda escrito por qué esa orden no iba.
 */
export function validarQueSePuedeEliminar(orden: OrdenTrabajo, materialesCargados: number): void {
  if (orden.estado !== 'ANULADA') {
    throw new ErrorTransicionInvalida(
      `Solo se elimina una orden anulada. La ${orden.numero} está ` +
        `${ETIQUETA_ESTADO_TRABAJO[orden.estado].toLowerCase()}: anulala primero, así queda ` +
        'dicho por qué no iba antes de que desaparezca.',
    );
  }

  // Hoy una orden anulada no puede tener materiales, porque anular ya lo
  // exige. Queda igual como segundo cerrojo: si alguna vez se afloja aquella
  // regla, esta sigue impidiendo que se borre algo que movió el pañol.
  if (materialesCargados > 0) {
    throw new ErrorTransicionInvalida(
      `La orden ${orden.numero} tiene materiales cargados: no se puede eliminar sin dejar ` +
        'salidas de stock que ninguna orden explica.',
    );
  }
}

/** Lo que se usó, para mostrar arriba de la orden y en la ficha del equipo. */
export interface ResumenTrabajo {
  materialesDistintos: number;
  unidadesTotales: number;
}

export function resumirMateriales(materiales: readonly MaterialUsado[]): ResumenTrabajo {
  return {
    materialesDistintos: new Set(materiales.map((m) => m.materialId)).size,
    unidadesTotales: materiales.reduce((suma, m) => suma + m.cantidad, 0),
  };
}
