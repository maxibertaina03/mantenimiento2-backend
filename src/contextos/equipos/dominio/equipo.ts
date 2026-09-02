import { ErrorDatosInvalidos } from './errores';
import { EstadoEquipo } from './estado-equipo';

/**
 * Qué tan grave es que este equipo se pare.
 *
 * No es decorativo: ordena la pantalla de servicios que vencen. Con doscientos
 * equipos, "qué atiendo primero" se contesta mirando esto.
 */
export const CRITICIDADES = ['ALTA', 'MEDIA', 'BAJA'] as const;
export type Criticidad = (typeof CRITICIDADES)[number];

export interface Equipo {
  id: string;
  codigoInterno: string | null;
  nombre: string;
  descripcion: string | null;
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  ubicacionId: string | null;
  tipoId: string | null;
  estado: EstadoEquipo;
  criticidad: Criticidad;
  fotoUrl: string | null;
  proveedorId: string | null;
  horasUso: number | null;
  fechaAlta: Date | null;
  garantiaHasta: Date | null;
}

/** Lo mínimo para dar de alta un equipo. */
export interface DatosNuevoEquipo {
  nombre: string;
  codigoInterno?: string | null;
  descripcion?: string | null;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  ubicacionId?: string | null;
  tipoId?: string | null;
  criticidad?: Criticidad;
  fotoUrl?: string | null;
  proveedorId?: string | null;
  horasUso?: number | null;
  fechaAlta?: Date | null;
  garantiaHasta?: Date | null;
}

const LARGO_MAXIMO_NOMBRE = 120;

/**
 * Deja el texto listo para guardar, o null si no había nada.
 *
 * Un campo vacío y un campo con espacios tienen que guardarse igual: si uno
 * queda como `""` y otro como `null`, después hay que preguntar por los dos en
 * cada consulta y tarde o temprano alguien se olvida de uno.
 */
export function normalizarTexto(valor: string | null | undefined): string | null {
  const limpio = (valor ?? '').trim().replace(/\s+/g, ' ');
  return limpio === '' ? null : limpio;
}

/**
 * El código interno en su forma canónica.
 *
 * Se guarda en mayúsculas porque es un identificador, no un nombre: "comp-01"
 * y "COMP-01" son el mismo equipo, y sin normalizar entrarían como dos.
 */
export function normalizarCodigoInterno(valor: string | null | undefined): string | null {
  const limpio = normalizarTexto(valor);
  return limpio === null ? null : limpio.toUpperCase();
}

/**
 * Arma un equipo válido a partir de datos crudos.
 *
 * Devuelve el equipo sin `id`: el identificador lo pone quien persiste, no el
 * dominio. Así esta función se puede probar sin base de datos.
 */
export function crearEquipo(datos: DatosNuevoEquipo): Omit<Equipo, 'id'> {
  const nombre = normalizarTexto(datos.nombre);
  if (nombre === null) {
    throw new ErrorDatosInvalidos('El equipo necesita un nombre.');
  }
  if (nombre.length > LARGO_MAXIMO_NOMBRE) {
    throw new ErrorDatosInvalidos(
      `El nombre no puede superar los ${LARGO_MAXIMO_NOMBRE} caracteres.`,
    );
  }

  if (datos.horasUso !== undefined && datos.horasUso !== null && datos.horasUso < 0) {
    throw new ErrorDatosInvalidos('Las horas de uso no pueden ser negativas.');
  }

  return {
    codigoInterno: normalizarCodigoInterno(datos.codigoInterno),
    nombre,
    descripcion: normalizarTexto(datos.descripcion),
    marca: normalizarTexto(datos.marca),
    modelo: normalizarTexto(datos.modelo),
    numeroSerie: normalizarTexto(datos.numeroSerie),
    ubicacionId: datos.ubicacionId ?? null,
    tipoId: datos.tipoId ?? null,
    // Un equipo se da de alta operativo: si estuviera roto al comprarlo, se
    // cambia después, pero el caso normal no debería pedir un dato más.
    estado: 'OPERATIVO',
    criticidad: datos.criticidad ?? 'MEDIA',
    fotoUrl: datos.fotoUrl ?? null,
    proveedorId: datos.proveedorId ?? null,
    horasUso: datos.horasUso ?? null,
    fechaAlta: datos.fechaAlta ?? null,
    garantiaHasta: datos.garantiaHasta ?? null,
  };
}

/**
 * Si la garantía ya venció.
 *
 * Recibe la fecha de hoy en vez de preguntarla: así el test puede decir "hoy es
 * tal día" y verificar el borde exacto, en lugar de depender de cuándo corra.
 */
export function garantiaVencida(garantiaHasta: Date | null, hoy: Date): boolean {
  if (garantiaHasta === null) return false;
  return garantiaHasta.getTime() < hoy.getTime();
}
