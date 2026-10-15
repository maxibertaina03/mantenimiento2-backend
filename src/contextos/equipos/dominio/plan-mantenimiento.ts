import {
  alSiguienteDiaDeTrabajo,
  TODOS_LOS_DIAS,
  validarDiasSemana,
} from '../../../common/dominio/dias-de-trabajo';
import { ErrorDatosInvalidos, ErrorTransicionInvalida } from './errores';
import { EstadoEquipo, requiereMantenimiento } from './estado-equipo';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Cuántos días antes se avisa por correo. */
export const DIAS_DE_AVISO = 7;

/**
 * Cómo se cuenta el próximo service después de hacer uno.
 *
 * - `DESDE_TRABAJO`: desde el día en que se hizo. Tocaba el sábado 10/10, se
 *   hizo el miércoles 14/10, cada 14 días → el 28/10. Es como fue siempre.
 * - `CALENDARIO`: se respetan las fechas planificadas aunque haya atrasos: el
 *   mismo caso da el 24/10. Sirve cuando el service va atado a un día fijo
 *   (el sábado que para la planta).
 */
export const MODOS_PROXIMA = ['DESDE_TRABAJO', 'CALENDARIO'] as const;
export type ModoProxima = (typeof MODOS_PROXIMA)[number];

export const ETIQUETA_MODO_PROXIMA: Record<ModoProxima, string> = {
  DESDE_TRABAJO: 'Contar desde que se hizo',
  CALENDARIO: 'Respetar el calendario',
};

export interface PlanMantenimiento {
  id: string;
  equipoId: string;
  nombre: string;
  tareas: string | null;
  periodicidadDias: number;
  /** Los días que se trabaja: 0 domingo … 6 sábado. Por defecto, lunes a viernes. */
  diasSemana: number[];
  /** Cuándo toca la próxima vez. Se calcula, pero se puede corregir a mano. */
  proximaFecha: Date;
  /** Cómo se cuenta el próximo después de hacer uno. */
  modoProxima: ModoProxima;
  /**
   * Si se postergó: la fecha que tenía antes. En un plan que respeta el
   * calendario, el siguiente se sigue contando desde acá y no desde la
   * postergada. Se borra al registrar el trabajo.
   */
  postergadoDesde: Date | null;
  activo: boolean;
}

export interface DatosNuevoPlan {
  equipoId: string;
  nombre: string;
  tareas?: string | null;
  periodicidadDias: number;
  /** Sin esto, lunes a viernes. */
  diasSemana?: number[] | null;
  proximaFecha: Date;
  /** Sin esto, desde que se hizo: como fue siempre. */
  modoProxima?: ModoProxima;
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
export function proximaFechaDespuesDe(
  fechaDelTrabajo: Date,
  periodicidadDias: number,
  // Si cae un día que no se trabaja (la purga del viernes, diaria, daría
  // sábado), pasa al siguiente que sí: el lunes.
  diasSemana: readonly number[] = TODOS_LOS_DIAS,
): Date {
  const proxima = new Date(fechaDelTrabajo.getTime());
  proxima.setUTCDate(proxima.getUTCDate() + periodicidadDias);
  return alSiguienteDiaDeTrabajo(proxima, diasSemana);
}

/**
 * La próxima fecha después de un trabajo, sin caer en un día que ya se hizo.
 *
 * Se cuenta desde el día real del trabajo: un cambio de aceite cada 90 días
 * hecho tres días antes tiene el siguiente a los 90 días de cuando se hizo.
 * Pero si esa cuenta cae en la tarea que el trabajo acaba de cerrar, o antes,
 * se cuenta desde esa tarea. Pasa con lo diario hecho por adelantado: la purga
 * de mañana hecha hoy daba «mañana», un día ya hecho, y el plan quedaba
 * apuntando a una tarea cerrada (el 5/10/2026, con tres purgas).
 *
 * @param yaHechoHasta la fecha de la tarea que cerró este trabajo, si hay una
 */
export function proximaFechaTrasTrabajo(
  fechaDelTrabajo: Date,
  periodicidadDias: number,
  diasSemana: readonly number[] = TODOS_LOS_DIAS,
  yaHechoHasta?: Date | null,
): Date {
  const proxima = proximaFechaDespuesDe(fechaDelTrabajo, periodicidadDias, diasSemana);
  // Por día, no por hora: el trabajo adelantado tiene la hora en que se hizo,
  // y «mañana a las 19:25» no es posterior al día de mañana.
  const dia = (f: Date) => f.toISOString().slice(0, 10);
  if (yaHechoHasta && dia(proxima) <= dia(yaHechoHasta)) {
    return proximaFechaDespuesDe(yaHechoHasta, periodicidadDias, diasSemana);
  }
  return proxima;
}

/** El día, como texto: para comparar días sin que moleste la hora. */
const dia = (f: Date) => f.toISOString().slice(0, 10);

/** `fecha` más `n` días, corrida al siguiente día de trabajo si cae en uno que no. */
function sumarDias(fecha: Date, n: number, diasSemana: readonly number[]): Date {
  const resultado = new Date(fecha.getTime());
  resultado.setUTCDate(resultado.getUTCDate() + n);
  return alSiguienteDiaDeTrabajo(resultado, diasSemana);
}

/**
 * La próxima fecha respetando el calendario: la siguiente fecha planificada
 * (`programada` + N veces la periodicidad) que todavía no pasó.
 *
 * Tocaba el sábado 10/10, cada 14 días:
 * - hecho el 14/10 → 24/10;
 * - hecho el 26/10, cuando el 24/10 ya pasó → 07/11. Salta a la siguiente que
 *   viene en vez de nacer vencido.
 *
 * Tampoco puede caer en el día de la tarea que se acaba de cerrar, o antes.
 *
 * @param programada la fecha que tenía planificada (la original, si se postergó)
 */
export function proximaFechaEnCalendario(
  programada: Date,
  periodicidadDias: number,
  diasSemana: readonly number[],
  fechaDelTrabajo: Date,
  yaHechoHasta?: Date | null,
): Date {
  const limite = [dia(fechaDelTrabajo), yaHechoHasta ? dia(yaHechoHasta) : ''].sort().pop()!;
  // Se salta directo cerca del límite: un plan diario atrasado un año no
  // tiene que probar 365 fechas una por una.
  const atraso = Math.max(0, diasEntre(programada, new Date(`${limite}T00:00:00.000Z`)));
  let veces = Math.max(1, Math.floor(atraso / periodicidadDias));
  for (;;) {
    const candidata = sumarDias(programada, veces * periodicidadDias, diasSemana);
    if (dia(candidata) > limite) return candidata;
    veces += 1;
  }
}

/** La próxima fecha de un plan después de hacer el trabajo, según su modo. */
export function proximaFechaSegunPlan(
  plan: Pick<
    PlanMantenimiento,
    'modoProxima' | 'proximaFecha' | 'postergadoDesde' | 'periodicidadDias' | 'diasSemana'
  >,
  fechaDelTrabajo: Date,
  yaHechoHasta?: Date | null,
): Date {
  if (plan.modoProxima === 'CALENDARIO') {
    return proximaFechaEnCalendario(
      plan.postergadoDesde ?? plan.proximaFecha,
      plan.periodicidadDias,
      plan.diasSemana,
      fechaDelTrabajo,
      yaHechoHasta,
    );
  }
  return proximaFechaTrasTrabajo(
    fechaDelTrabajo,
    plan.periodicidadDias,
    plan.diasSemana,
    yaHechoHasta,
  );
}

/**
 * Postergar el próximo service: «lo vamos a hacer, pero dos o tres días más
 * tarde».
 *
 * - Solo si todavía no venció: lo vencido no se posterga, se hace.
 * - La fecha nueva tiene que ser posterior a la que tenía, y anterior a la vez
 *   siguiente que toca (la original más la periodicidad): postergar no puede
 *   comerse el próximo service.
 * - Si cae un día que no se trabaja, pasa al siguiente que sí.
 * - Se guarda la original (la primera, si se posterga dos veces) para contar el
 *   siguiente desde ahí en los planes que respetan el calendario.
 */
export function postergarPlan(
  plan: Pick<
    PlanMantenimiento,
    'nombre' | 'proximaFecha' | 'postergadoDesde' | 'periodicidadDias' | 'diasSemana' | 'activo'
  >,
  nuevaFecha: Date,
  hoy: Date,
): Pick<PlanMantenimiento, 'proximaFecha' | 'postergadoDesde'> {
  if (!plan.activo) {
    throw new ErrorTransicionInvalida(
      `El plan «${plan.nombre}» está pausado: no hay nada que postergar.`,
    );
  }
  if (diasParaVencer(plan.proximaFecha, hoy) < 0) {
    throw new ErrorTransicionInvalida(
      `«${plan.nombre}» ya venció: lo vencido no se posterga, se hace. Registrá el trabajo ` +
        'cuando se haga.',
    );
  }
  const fecha = alSiguienteDiaDeTrabajo(nuevaFecha, plan.diasSemana);
  if (dia(fecha) <= dia(plan.proximaFecha)) {
    throw new ErrorDatosInvalidos('La fecha nueva tiene que ser posterior a la que tenía.');
  }
  const original = plan.postergadoDesde ?? plan.proximaFecha;
  const siguiente = sumarDias(original, plan.periodicidadDias, plan.diasSemana);
  if (dia(fecha) >= dia(siguiente)) {
    throw new ErrorDatosInvalidos(
      `Se puede postergar hasta antes del ${formatoDia(siguiente)}, que es cuando vuelve a ` +
        'tocar. Más que eso ya no es postergar: es saltearse un service.',
    );
  }
  return { proximaFecha: fecha, postergadoDesde: original };
}

/** 24/10/2026, para los mensajes. */
function formatoDia(fecha: Date): string {
  const [a, m, d] = dia(fecha).split('-');
  return `${d}/${m}/${a}`;
}

const MAXIMO_DIAS = 3650; // diez años

function validarModo(modo: ModoProxima | undefined): ModoProxima {
  if (modo === undefined) return 'DESDE_TRABAJO';
  if (!MODOS_PROXIMA.includes(modo)) {
    throw new ErrorDatosInvalidos(
      'El modo tiene que ser «desde que se hizo» o «respetar el calendario».',
    );
  }
  return modo;
}

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
  const diasSemana = validarDiasSemana(datos.diasSemana);

  return {
    equipoId: datos.equipoId,
    nombre,
    tareas: tareas === '' ? null : tareas,
    periodicidadDias: datos.periodicidadDias,
    diasSemana,
    // Una fecha cargada a mano en un sábado también pasa al lunes.
    proximaFecha: alSiguienteDiaDeTrabajo(datos.proximaFecha, diasSemana),
    modoProxima: validarModo(datos.modoProxima),
    postergadoDesde: null,
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
