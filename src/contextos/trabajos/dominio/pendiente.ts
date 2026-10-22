import { ErrorDatosInvalidos, ErrorNoEsSuyo, ErrorTransicionInvalida } from './errores';

/**
 * Un pendiente del anotador de mantenimiento: «comprar rulemanes 6204»,
 * «mandar a rebobinar el motor de la bomba 2».
 *
 * No es una tarea del calendario: no tiene fecha ni se repite. Es lo que quedó
 * por hacer y no se tiene que olvidar, a la vista de todo mantenimiento hasta
 * que alguien lo tilda.
 */
export interface Pendiente {
  id: string;
  texto: string;
  urgente: boolean;
  asignadoAId: string | null;
  equipoId: string | null;
  creadoPorId: string | null;
  creadoEn: Date;
  hechaEn: Date | null;
  hechaPorId: string | null;
  /** La orden de trabajo que se registró al hacerlo, si era sobre una máquina. */
  ordenTrabajoId: string | null;
}

export const LARGO_MAXIMO_PENDIENTE = 500;

/** El texto, limpio: sin espacios de más. Vacío o demasiado largo no se acepta. */
export function validarTextoPendiente(texto: string): string {
  const limpio = texto.trim().replace(/\s+/g, ' ');
  if (!limpio) throw new ErrorDatosInvalidos('Escribí qué es lo que quedó pendiente.');
  if (limpio.length > LARGO_MAXIMO_PENDIENTE) {
    throw new ErrorDatosInvalidos(
      `El pendiente puede tener hasta ${LARGO_MAXIMO_PENDIENTE} letras; este tiene ${limpio.length}.`,
    );
  }
  return limpio;
}

export function validarQueSigaPendiente(p: Pick<Pendiente, 'hechaEn'>): void {
  if (p.hechaEn) throw new ErrorTransicionInvalida('Ese pendiente ya está hecho.');
}

export function validarQueEsteHecho(p: Pick<Pendiente, 'hechaEn'>): void {
  if (!p.hechaEn) throw new ErrorTransicionInvalida('Ese pendiente todavía no está hecho.');
}

/**
 * Borrar solo puede quien lo anotó, o un administrador. Al resto le queda
 * tildarlo como hecho: así no desaparece algo que anotó otro sin que sepa por
 * qué.
 */
export function validarQuePuedeBorrar(
  p: Pick<Pendiente, 'creadoPorId'>,
  usuarioId: string | null,
  esAdministrador: boolean,
): void {
  if (esAdministrador) return;
  if (!usuarioId || p.creadoPorId !== usuarioId) {
    throw new ErrorNoEsSuyo(
      'Solo quien lo anotó puede borrarlo. Si ya está resuelto, marcalo como hecho.',
    );
  }
}

/**
 * Si le toca a alguien, solo esa persona lo da por hecho (o un administrador,
 * por si esa persona ya no está). Así nadie lo saca de la lista por tocar el
 * círculo de uno ajeno. Sin responsable, lo puede hacer cualquiera.
 */
export function validarQuePuedeDarPorHecho(
  p: Pick<Pendiente, 'asignadoAId'> & { asignadoANombre?: string | null },
  usuarioId: string | null,
  esAdministrador: boolean,
): void {
  if (!p.asignadoAId || esAdministrador || p.asignadoAId === usuarioId) return;
  const quien = p.asignadoANombre ?? 'la persona a la que le toca';
  throw new ErrorNoEsSuyo(
    `Este pendiente le toca a ${quien}: solo ${quien} lo puede dar por hecho.`,
  );
}

/** Los urgentes primero; entre iguales, los más viejos arriba: hace más que esperan. */
export function ordenarPendientes<T extends Pick<Pendiente, 'urgente' | 'creadoEn'>>(
  lista: T[],
): T[] {
  return [...lista].sort(
    (a, b) => Number(b.urgente) - Number(a.urgente) || a.creadoEn.getTime() - b.creadoEn.getTime(),
  );
}
