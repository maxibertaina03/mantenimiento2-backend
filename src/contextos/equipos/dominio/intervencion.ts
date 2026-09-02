import { ErrorDatosInvalidos } from './errores';
import { EstadoEquipo, ETIQUETA_ESTADO } from './estado-equipo';

/**
 * Qué clase de trabajo se le hizo al equipo.
 *
 * La distinción no es burocrática: es la que después contesta "¿cuánto de lo
 * que gastamos fue planificado y cuánto fue apagar incendios?". Un equipo con
 * muchos correctivos y pocos preventivos es un equipo mal mantenido, y eso solo
 * se ve si el dato está separado desde el principio.
 */
export const TIPOS_INTERVENCION = ['PREVENTIVO', 'CORRECTIVO', 'MEJORA'] as const;
export type TipoIntervencion = (typeof TIPOS_INTERVENCION)[number];

export const ETIQUETA_TIPO_INTERVENCION: Record<TipoIntervencion, string> = {
  PREVENTIVO: 'Preventivo',
  CORRECTIVO: 'Correctivo',
  MEJORA: 'Mejora',
};

/** Quién hizo el trabajo: la planta o un tercero. */
export const EJECUTORES = ['INTERNO', 'EXTERNO'] as const;
export type Ejecutor = (typeof EJECUTORES)[number];

export const ETIQUETA_EJECUTOR: Record<Ejecutor, string> = {
  INTERNO: 'En fábrica',
  EXTERNO: 'Servicio externo',
};

export interface Intervencion {
  id: string;
  equipoId: string;
  tipo: TipoIntervencion;
  fecha: Date;
  ejecutor: Ejecutor;
  /** Quién lo hizo, si fue interno. */
  usuarioId: string | null;
  /** Quién lo hizo, si fue externo. */
  proveedorId: string | null;
  descripcion: string;
  costoManoObra: number | null;
  horasParada: number | null;
  documentoUrl: string | null;
  registradoPorId: string | null;
  creadoEn: Date;
}

export interface DatosNuevaIntervencion {
  equipoId: string;
  tipo: TipoIntervencion;
  fecha: Date;
  ejecutor: Ejecutor;
  usuarioId?: string | null;
  proveedorId?: string | null;
  descripcion: string;
  costoManoObra?: number | null;
  horasParada?: number | null;
  documentoUrl?: string | null;
  registradoPorId?: string | null;
}

/** Margen de tolerancia para la fecha, por diferencias de reloj y de huso. */
const MARGEN_FUTURO_MS = 24 * 60 * 60 * 1000;

/**
 * Arma una intervención válida.
 *
 * Recibe `hoy` en vez de preguntarlo: así el test verifica el borde exacto de
 * "no se puede registrar en el futuro" sin depender de cuándo corra.
 */
export function crearIntervencion(
  datos: DatosNuevaIntervencion,
  estadoDelEquipo: EstadoEquipo,
  hoy: Date,
): Omit<Intervencion, 'id' | 'creadoEn'> {
  // Un equipo dado de baja ya no está: registrarle un service es un error de
  // carga, casi siempre porque se eligió el equipo equivocado de la lista.
  if (estadoDelEquipo === 'DADO_DE_BAJA') {
    throw new ErrorDatosInvalidos(
      `El equipo está ${ETIQUETA_ESTADO.DADO_DE_BAJA.toLowerCase()}: no se le pueden registrar ` +
        'intervenciones. Si te equivocaste de equipo, elegí el correcto.',
    );
  }

  const descripcion = datos.descripcion.trim().replace(/\s+/g, ' ');
  if (descripcion === '') {
    throw new ErrorDatosInvalidos(
      'Contá qué se hizo. Un historial de fechas sin decir qué se hizo no sirve para nada.',
    );
  }

  if (datos.fecha.getTime() > hoy.getTime() + MARGEN_FUTURO_MS) {
    throw new ErrorDatosInvalidos(
      'La fecha no puede ser futura: acá se registra lo que ya se hizo, no lo que está planificado.',
    );
  }

  // El ejecutor es lo que después contesta "cuánto gastamos con este proveedor
  // el año pasado". Si fuera un texto libre, esa pregunta no se podría hacer.
  if (datos.ejecutor === 'INTERNO' && !datos.usuarioId) {
    throw new ErrorDatosInvalidos('Si el trabajo se hizo en fábrica, indicá quién lo hizo.');
  }
  if (datos.ejecutor === 'EXTERNO' && !datos.proveedorId) {
    throw new ErrorDatosInvalidos('Si el trabajo lo hizo un tercero, indicá qué proveedor.');
  }

  for (const [campo, valor, etiqueta] of [
    ['costoManoObra', datos.costoManoObra, 'El costo'],
    ['horasParada', datos.horasParada, 'Las horas de parada'],
  ] as const) {
    if (valor !== undefined && valor !== null && valor < 0) {
      throw new ErrorDatosInvalidos(`${etiqueta} no puede ser negativo.`);
      // El campo queda nombrado arriba por si hace falta identificarlo.
      void campo;
    }
  }

  return {
    equipoId: datos.equipoId,
    tipo: datos.tipo,
    fecha: datos.fecha,
    ejecutor: datos.ejecutor,
    // Se guarda solo el que corresponde: dejar los dos permitiría una
    // intervención que dice ser interna y apunta a un proveedor.
    usuarioId: datos.ejecutor === 'INTERNO' ? (datos.usuarioId ?? null) : null,
    proveedorId: datos.ejecutor === 'EXTERNO' ? (datos.proveedorId ?? null) : null,
    descripcion,
    costoManoObra: datos.costoManoObra ?? null,
    horasParada: datos.horasParada ?? null,
    documentoUrl: datos.documentoUrl ?? null,
    registradoPorId: datos.registradoPorId ?? null,
  };
}

/** Resumen de mantenimiento de un equipo, para mostrar en su ficha. */
export interface ResumenMantenimiento {
  ultimaFecha: Date | null;
  cantidad: number;
  correctivos: number;
  preventivos: number;
  costoTotal: number;
  horasParadaTotal: number;
}

/**
 * Arma el resumen a partir del historial.
 *
 * El costo suma solo lo que tiene precio cargado. No se pone en cero lo que
 * falta: un total que mezcla "gratis" con "no lo sabemos" es un número que
 * miente, y las decisiones de reparar o reemplazar se toman con ese número.
 */
export function resumirMantenimiento(intervenciones: Intervencion[]): ResumenMantenimiento {
  const fechas = intervenciones.map((i) => i.fecha.getTime());

  return {
    ultimaFecha: fechas.length > 0 ? new Date(Math.max(...fechas)) : null,
    cantidad: intervenciones.length,
    correctivos: intervenciones.filter((i) => i.tipo === 'CORRECTIVO').length,
    preventivos: intervenciones.filter((i) => i.tipo === 'PREVENTIVO').length,
    costoTotal: intervenciones.reduce((suma, i) => suma + (i.costoManoObra ?? 0), 0),
    horasParadaTotal: intervenciones.reduce((suma, i) => suma + (i.horasParada ?? 0), 0),
  };
}
