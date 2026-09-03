import { ErrorDatosInvalidos } from './errores';
import { EstadoEquipo, requiereMantenimiento } from './estado-equipo';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Cuántos días antes se avisa por correo. */
export const DIAS_DE_AVISO = 7;

export interface PlanMantenimiento {
  id: string;
  equipoId: string;
  nombre: string;
  tareas: string | null;
  periodicidadDias: number;
  /** Cuándo toca la próxima vez. Se calcula, pero se puede corregir a mano. */
  proximaFecha: Date;
  activo: boolean;
}

export interface DatosNuevoPlan {
  equipoId: string;
  nombre: string;
  tareas?: string | null;
  periodicidadDias: number;
  proximaFecha: Date;
}

/** Cuán urgente está un plan. Ordena la pantalla de servicios que vencen. */
export const ESTADOS_PLAN = ['VENCIDO', 'POR_VENCER', 'AL_DIA'] as const;
export type EstadoPlan = (typeof ESTADOS_PLAN)[number];

export const ETIQUETA_ESTADO_PLAN: Record<EstadoPlan, string> = {
  VENCIDO: 'Vencido',
  POR_VENCER: 'Por vencer',
  AL_DIA: 'Al día',
};

/**
 * Días entre dos fechas, contados por día de calendario.
 *
 * Comparar los instantes exactos haría que un service de "hoy a las 8" y otro
 * de "hoy a las 18" den distinto, y para esto los dos son hoy.
 */
export function diasEntre(desde: Date, hasta: Date): number {
  const a = Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate());
  const b = Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), hasta.getUTCDate());
  return Math.round((b - a) / MS_POR_DIA);
}

/** Cuántos días faltan para el próximo service. Negativo si ya venció. */
export function diasParaVencer(proximaFecha: Date, hoy: Date): number {
  return diasEntre(hoy, proximaFecha);
}

/**
 * En qué estado está un plan.
 *
 * El día exacto del vencimiento todavía cuenta como "por vencer", no como
 * vencido: si toca hoy y se hace hoy, se hizo en fecha.
 */
export function estadoPlan(proximaFecha: Date, hoy: Date, diasDeAviso = DIAS_DE_AVISO): EstadoPlan {
  const faltan = diasParaVencer(proximaFecha, hoy);
  if (faltan < 0) return 'VENCIDO';
  if (faltan <= diasDeAviso) return 'POR_VENCER';
  return 'AL_DIA';
}

/**
 * La próxima fecha después de hacer el trabajo.
 *
 * Se cuenta desde el día en que se hizo, no desde el que estaba planificado. Si
 * un service que tocaba en marzo se hizo en mayo, el siguiente va a los noventa
 * días de mayo: contarlo desde marzo lo dejaría vencido apenas se registra.
 */
export function proximaFechaDespuesDe(fechaDelTrabajo: Date, periodicidadDias: number): Date {
  const proxima = new Date(fechaDelTrabajo.getTime());
  proxima.setUTCDate(proxima.getUTCDate() + periodicidadDias);
  return proxima;
}

const MAXIMO_DIAS = 3650; // diez años

export function crearPlan(datos: DatosNuevoPlan): Omit<PlanMantenimiento, 'id'> {
  const nombre = datos.nombre.trim().replace(/\s+/g, ' ');
  if (nombre === '') {
    throw new ErrorDatosInvalidos('El plan necesita un nombre. Por ejemplo: "Cambio de aceite".');
  }

  if (!Number.isInteger(datos.periodicidadDias) || datos.periodicidadDias < 1) {
    throw new ErrorDatosInvalidos(
      'La periodicidad tiene que ser de al menos un día, en días enteros.',
    );
  }
  if (datos.periodicidadDias > MAXIMO_DIAS) {
    throw new ErrorDatosInvalidos(
      'La periodicidad no puede superar los diez años. ¿Está bien el número de días?',
    );
  }

  const tareas = (datos.tareas ?? '').trim();

  return {
    equipoId: datos.equipoId,
    nombre,
    tareas: tareas === '' ? null : tareas,
    periodicidadDias: datos.periodicidadDias,
    proximaFecha: datos.proximaFecha,
    activo: true,
  };
}

/** Un plan con su urgencia ya calculada, para mostrarlo. */
export interface PlanConEstado extends PlanMantenimiento {
  estado: EstadoPlan;
  diasParaVencer: number;
}

export function conEstado(plan: PlanMantenimiento, hoy: Date): PlanConEstado {
  return {
    ...plan,
    estado: estadoPlan(plan.proximaFecha, hoy),
    diasParaVencer: diasParaVencer(plan.proximaFecha, hoy),
  };
}

/**
 * Si este plan tiene que generar un aviso hoy.
 *
 * Junta las tres condiciones en un solo lugar, y esa es la razón de que exista:
 * repartidas entre la consulta y el envío, cambiar una y olvidarse de la otra
 * es cuestión de tiempo.
 */
export function correspondeAvisar(
  plan: PlanMantenimiento,
  estadoDelEquipo: EstadoEquipo,
  hoy: Date,
  diasDeAviso = DIAS_DE_AVISO,
): boolean {
  if (!plan.activo) return false;
  // Un equipo fuera de servicio o dado de baja no genera avisos: no tiene
  // sentido pedir un service para algo que está desafectado.
  if (!requiereMantenimiento(estadoDelEquipo)) return false;

  const faltan = diasParaVencer(plan.proximaFecha, hoy);
  // También los vencidos: si nadie lo hizo, hay que seguir avisando.
  return faltan <= diasDeAviso;
}

/** Los más urgentes primero: primero lo vencido, después lo que está por vencer. */
export function ordenarPorUrgencia(planes: PlanConEstado[]): PlanConEstado[] {
  return [...planes].sort((a, b) => a.diasParaVencer - b.diasParaVencer);
}
