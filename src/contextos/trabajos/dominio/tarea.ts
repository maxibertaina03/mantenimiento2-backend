import { ErrorDatosInvalidos, ErrorNoEsSuyo, ErrorTransicionInvalida } from './errores';

/**
 * Una tarea programada: algo que hay que hacer, con fecha y con dueño.
 *
 * Es la pieza que faltaba entre las otras dos. Un plan de mantenimiento es una
 * definición que se repite y no se le asigna a nadie. Una orden de trabajo es
 * un hecho consumado, y por eso no acepta fecha futura. La tarea vive en el
 * medio: está para hacer, alguien tiene que hacerla, y cuando se hace se
 * convierte en una orden de trabajo.
 *
 * Tres cosas pueden crearla: una persona, un plan de mantenimiento que vence, o
 * una rutina que se repite. Las tres terminan en la misma fila, así que el
 * calendario es una sola lista y no tres.
 */

export const ESTADOS_TAREA = ['PENDIENTE', 'HECHA', 'CANCELADA'] as const;
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];

export const ETIQUETA_ESTADO_TAREA: Record<EstadoTarea, string> = {
  PENDIENTE: 'Pendiente',
  HECHA: 'Hecha',
  CANCELADA: 'Cancelada',
};

export interface Tarea {
  id: string;
  titulo: string;
  descripcion: string | null;
  /** El día en que hay que hacerla. */
  fecha: Date;
  estado: EstadoTarea;
  /**
   * Quién tiene que hacerla. Puede estar vacía.
   *
   * Las que genera un plan nacen sin dueño a propósito: el sistema sabe que hay
   * que hacer un service, no sabe a quién le toca. Repartirlas es una decisión
   * de una persona, y dejarlas visibles sin dueño es lo que hace que esa
   * decisión se tome en vez de quedar implícita.
   */
  asignadoAId: string | null;
  equipoId: string | null;
  /** El plan de mantenimiento que la generó, si vino de uno. */
  planId: string | null;
  /** La rutina que la generó, si se repite. */
  rutinaId: string | null;
  /** La orden de trabajo que salió al completarla. */
  ordenTrabajoId: string | null;
  creadaPorId: string | null;
  creadoEn: Date;
}

export interface DatosNuevaTarea {
  titulo: string;
  descripcion?: string | null;
  fecha: Date;
  asignadoAId?: string | null;
  equipoId?: string | null;
  planId?: string | null;
  rutinaId?: string | null;
  creadaPorId?: string | null;
}

/** Deja el texto en una sola línea de espacios simples, o `null` si quedó vacío. */
function limpiar(texto: string | null | undefined): string | null {
  const limpio = (texto ?? '').trim().replace(/\s+/g, ' ');
  return limpio === '' ? null : limpio;
}

/** El día, sin hora. Dos tareas del mismo día son del mismo día aunque se carguen a horas distintas. */
export function soloElDia(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
}

export function crearTarea(datos: DatosNuevaTarea): Omit<Tarea, 'id' | 'creadoEn'> {
  const titulo = limpiar(datos.titulo);
  if (titulo === null) {
    throw new ErrorDatosInvalidos(
      'Contá qué hay que hacer. Una tarea sin título en un calendario no le dice nada a nadie.',
    );
  }

  return {
    titulo,
    descripcion: limpiar(datos.descripcion),
    // Al revés que una orden de trabajo, una tarea SÍ puede ser futura: es
    // justamente lo que todavía no se hizo.
    fecha: soloElDia(datos.fecha),
    estado: 'PENDIENTE',
    asignadoAId: datos.asignadoAId ?? null,
    equipoId: datos.equipoId ?? null,
    planId: datos.planId ?? null,
    rutinaId: datos.rutinaId ?? null,
    ordenTrabajoId: null,
    creadaPorId: datos.creadaPorId ?? null,
  };
}

/** Solo se toca una tarea que todavía está por hacerse. */
function validarQueEstaPendiente(tarea: Tarea, accion: string): void {
  if (tarea.estado !== 'PENDIENTE') {
    throw new ErrorTransicionInvalida(
      `La tarea «${tarea.titulo}» está ${ETIQUETA_ESTADO_TAREA[tarea.estado].toLowerCase()}: ` +
        `no se puede ${accion}.`,
    );
  }
}

export function asignarTarea(tarea: Tarea, usuarioId: string): Pick<Tarea, 'asignadoAId'> {
  validarQueEstaPendiente(tarea, 'reasignar');
  return { asignadoAId: usuarioId };
}

/**
 * Quién puede darla por hecha.
 *
 * La suya, cualquiera de las que tiene asignadas. Una sin dueño también, y al
 * completarla queda a su nombre: el que la hizo es el que la hizo, y si no
 * quedara registrado el historial diría que nadie la hizo.
 *
 * La de otro, no. Si dos personas pueden cerrar la misma tarea, el reparto
 * deja de significar algo.
 */
export function validarQuePuedeCompletarla(tarea: Tarea, usuarioId: string | null): void {
  if (usuarioId === null) {
    throw new ErrorNoEsSuyo('No se sabe quién sos, así que no se puede dar por hecha una tarea.');
  }
  if (tarea.asignadoAId !== null && tarea.asignadoAId !== usuarioId) {
    throw new ErrorNoEsSuyo(
      `La tarea «${tarea.titulo}» está asignada a otra persona. Podés verla, pero la hace quien ` +
        'la tiene a cargo. Si tiene que pasar a vos, pedí que te la reasignen.',
    );
  }
}

/**
 * Las dos condiciones para darla por hecha, juntas.
 *
 * Existe aparte para poder comprobarlas ANTES de tocar el stock: si la tarea no
 * es suya o ya está cerrada, no se mueve ni un material.
 */
export function validarQueSePuedeCompletar(tarea: Tarea, usuarioId: string | null): void {
  validarQueEstaPendiente(tarea, 'darla por hecha');
  validarQuePuedeCompletarla(tarea, usuarioId);
}

export function completarTarea(
  tarea: Tarea,
  usuarioId: string,
  ordenTrabajoId: string,
): Pick<Tarea, 'estado' | 'asignadoAId' | 'ordenTrabajoId'> {
  validarQueSePuedeCompletar(tarea, usuarioId);

  return {
    estado: 'HECHA',
    asignadoAId: tarea.asignadoAId ?? usuarioId,
    ordenTrabajoId,
  };
}

export function cancelarTarea(tarea: Tarea): Pick<Tarea, 'estado'> {
  validarQueEstaPendiente(tarea, 'cancelar');
  return { estado: 'CANCELADA' };
}

// ─────────────────────────── Rutinas ───────────────────────────

/**
 * Algo que se repite y no responde a ningún plan de mantenimiento.
 *
 * "Revisar la presión de la caldera todas las mañanas" no es un service de una
 * máquina con periodicidad: es una rutina del día. Cargarla una vez y que el
 * calendario la reparta es la diferencia entre que se haga y que no.
 */
export interface Rutina {
  id: string;
  titulo: string;
  descripcion: string | null;
  /** Cada cuántos días se repite. 1 es todos los días. */
  cadaDias: number;
  desde: Date;
  /** Hasta cuándo. Sin esto, para siempre. */
  hasta: Date | null;
  equipoId: string | null;
  /** A quién le toca siempre. Sin esto, cada ocurrencia nace sin dueño. */
  asignadoAId: string | null;
  activa: boolean;
  creadaPorId: string | null;
  creadoEn: Date;
}

export interface DatosNuevaRutina {
  titulo: string;
  descripcion?: string | null;
  cadaDias: number;
  desde: Date;
  hasta?: Date | null;
  equipoId?: string | null;
  asignadoAId?: string | null;
  creadaPorId?: string | null;
}

export function crearRutina(datos: DatosNuevaRutina): Omit<Rutina, 'id' | 'creadoEn'> {
  const titulo = limpiar(datos.titulo);
  if (titulo === null) {
    throw new ErrorDatosInvalidos('Contá qué hay que hacer en cada repetición.');
  }

  if (!Number.isInteger(datos.cadaDias) || datos.cadaDias < 1) {
    throw new ErrorDatosInvalidos(
      'Cada cuántos días se repite tiene que ser un número de días, ' + 'desde 1.',
    );
  }

  const desde = soloElDia(datos.desde);
  const hasta = datos.hasta ? soloElDia(datos.hasta) : null;
  if (hasta && hasta.getTime() < desde.getTime()) {
    throw new ErrorDatosInvalidos('La fecha de fin no puede ser anterior a la de inicio.');
  }

  return {
    titulo,
    descripcion: limpiar(datos.descripcion),
    cadaDias: datos.cadaDias,
    desde,
    hasta,
    equipoId: datos.equipoId ?? null,
    asignadoAId: datos.asignadoAId ?? null,
    activa: true,
    creadaPorId: datos.creadaPorId ?? null,
  };
}

const UN_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Qué días caen las repeticiones de una rutina dentro de un rango.
 *
 * Es función pura y por eso se puede probar sin base ni reloj, que es donde
 * importa: un error acá reparte tareas los días equivocados y nadie lo nota
 * hasta que alguien se queja de que le aparecen dos veces.
 *
 * Cuenta en días enteros desde `desde` y no sumando meses: así "cada 15 días"
 * significa siempre quince días, sin importar cuántos tenga el mes.
 */
export function ocurrenciasDeRutina(rutina: Rutina, desde: Date, hasta: Date): Date[] {
  if (!rutina.activa) return [];

  const inicio = soloElDia(desde);
  const fin = soloElDia(hasta);
  if (fin.getTime() < inicio.getTime()) return [];

  // El primer día de la rutina que cae dentro del rango.
  const base = rutina.desde.getTime();
  const desdeMs = Math.max(inicio.getTime(), base);
  const saltos = Math.ceil((desdeMs - base) / (rutina.cadaDias * UN_DIA_MS));

  const fechas: Date[] = [];
  for (let i = Math.max(0, saltos); ; i += 1) {
    const cuando = base + i * rutina.cadaDias * UN_DIA_MS;
    if (cuando > fin.getTime()) break;
    if (rutina.hasta && cuando > rutina.hasta.getTime()) break;
    if (cuando >= inicio.getTime()) fechas.push(new Date(cuando));
  }
  return fechas;
}
