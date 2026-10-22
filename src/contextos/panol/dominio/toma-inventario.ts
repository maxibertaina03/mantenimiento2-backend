import { ErrorDatosInvalidos, ErrorTransicionInvalida } from './errores';

/**
 * Una toma de inventario: contar lo que hay en el pañol y ajustar el stock.
 *
 * Se abre sobre una categoría, una estantería o todo el pañol, con un renglón
 * por material en uso. Se cuenta —pueden contar varias personas a la vez—, se
 * miran las diferencias y, al confirmar, cada diferencia se convierte en un
 * AJUSTE por el camino de siempre.
 *
 * El cuidado central: si un material se movió después de contarlo (alguien
 * sacó algo del estante), su conteo ya no describe el estante. Ajustarlo a
 * ciegas pisaría ese movimiento, así que queda para volver a contar.
 */

export const ESTADOS_TOMA = ['ABIERTA', 'CERRADA', 'ANULADA'] as const;
export type EstadoToma = (typeof ESTADOS_TOMA)[number];

export const RESULTADOS_RENGLON = ['AJUSTADO', 'SIN_DIFERENCIA', 'RECONTAR'] as const;
export type ResultadoRenglon = (typeof RESULTADOS_RENGLON)[number];

export interface TomaInventario {
  id: string;
  numero: string;
  /** Qué se cuenta. Las dos vacías: todo el pañol. */
  categoriaId: string | null;
  estanteriaId: string | null;
  estado: EstadoToma;
  notas: string | null;
  abiertaEn: Date;
  abiertaPorId: string | null;
  cerradaEn: Date | null;
  cerradaPorId: string | null;
  motivoAnulacion: string | null;
}

export interface RenglonToma {
  id: string;
  tomaId: string;
  materialId: string;
  /** Lo que se contó; null mientras no se cuenta. */
  contado: number | null;
  /** El stock que figuraba al contarlo: la diferencia es contra esto. */
  stockAlContar: number | null;
  contadoEn: Date | null;
  contadoPorId: string | null;
  resultado: ResultadoRenglon | null;
  movimientoId: string | null;
}

/** Qué hacer con un renglón al confirmar. */
export type Decision =
  | { tipo: 'AJUSTAR'; cantidad: number }
  | { tipo: 'SIN_DIFERENCIA' }
  | { tipo: 'RECONTAR' }
  | { tipo: 'NADA' };

/** Iguales con tres decimales, como se guardan: 2,5 y 2,500 son lo mismo. */
export function mismaCantidad(a: number, b: number): boolean {
  return Math.round(a * 1000) === Math.round(b * 1000);
}

/** Ya pasó por una confirmación y no se vuelve a tocar. */
export function estaResuelto(renglon: Pick<RenglonToma, 'resultado'>): boolean {
  return renglon.resultado === 'AJUSTADO' || renglon.resultado === 'SIN_DIFERENCIA';
}

export function validarQueEstaAbierta(
  toma: Pick<TomaInventario, 'numero' | 'estado'>,
  accion: string,
): void {
  if (toma.estado !== 'ABIERTA') {
    throw new ErrorTransicionInvalida(
      `La toma ${toma.numero} está ${toma.estado === 'CERRADA' ? 'cerrada' : 'anulada'}: ` +
        `no se puede ${accion}.`,
    );
  }
}

/**
 * Cargar (o corregir, o borrar con `null`) lo que se contó de un material.
 *
 * Guarda el stock que figura en ese momento: si después hay un movimiento, se
 * nota al confirmar. Un renglón que ya se ajustó no se toca más; uno marcado
 * para volver a contar, sí: contarlo de nuevo es justamente lo que pide.
 */
export function contarRenglon(
  toma: Pick<TomaInventario, 'numero' | 'estado'>,
  renglon: Pick<RenglonToma, 'resultado'>,
  cantidad: number | null,
  stockActual: number,
  ahora: Date,
  usuarioId: string | null,
): Pick<RenglonToma, 'contado' | 'stockAlContar' | 'contadoEn' | 'contadoPorId' | 'resultado'> {
  validarQueEstaAbierta(toma, 'cargar conteos');
  if (estaResuelto(renglon)) {
    throw new ErrorTransicionInvalida(
      'Ese material ya se confirmó en esta toma. Si el stock cambió, se corrige con un ajuste.',
    );
  }
  if (cantidad === null) {
    return {
      contado: null,
      stockAlContar: null,
      contadoEn: null,
      contadoPorId: null,
      resultado: null,
    };
  }
  if (!Number.isFinite(cantidad) || cantidad < 0) {
    throw new ErrorDatosInvalidos('Lo contado tiene que ser un número, cero o más.');
  }
  if (!mismaCantidad(cantidad, Math.round(cantidad * 1000) / 1000)) {
    throw new ErrorDatosInvalidos('Lo contado admite hasta tres decimales.');
  }
  return {
    contado: cantidad,
    stockAlContar: stockActual,
    contadoEn: ahora,
    contadoPorId: usuarioId,
    resultado: null,
  };
}

/**
 * Qué hacer con un renglón al confirmar.
 *
 * - Sin contar, o ya resuelto: nada.
 * - Se movió después de contarlo: volver a contar. Ajustar pisaría ese movimiento.
 * - Lo contado coincide con lo que figura: sin diferencia.
 * - Si no: un AJUSTE a lo contado.
 */
export function decidir(
  renglon: Pick<RenglonToma, 'contado' | 'resultado'>,
  stockActual: number,
  seMovioDespuesDeContar: boolean,
): Decision {
  if (renglon.contado === null || estaResuelto(renglon)) return { tipo: 'NADA' };
  if (seMovioDespuesDeContar) return { tipo: 'RECONTAR' };
  if (mismaCantidad(renglon.contado, stockActual)) return { tipo: 'SIN_DIFERENCIA' };
  return { tipo: 'AJUSTAR', cantidad: renglon.contado };
}

/**
 * Cerrar la toma: dar por terminado el conteo. Lo que no se contó no se toca.
 * Antes hay que confirmar lo contado: si no, ese conteo se perdería sin ajustar.
 */
export function validarCierre(
  toma: Pick<TomaInventario, 'numero' | 'estado'>,
  renglones: Pick<RenglonToma, 'contado' | 'resultado'>[],
): void {
  validarQueEstaAbierta(toma, 'cerrar');
  const sinConfirmar = renglones.filter((r) => r.contado !== null && !estaResuelto(r)).length;
  if (sinConfirmar > 0) {
    throw new ErrorTransicionInvalida(
      `Hay ${sinConfirmar} ${sinConfirmar === 1 ? 'material contado' : 'materiales contados'} ` +
        'sin confirmar. Confirmalos primero (o borrá ese conteo), así no se pierden.',
    );
  }
}

/** Se puede anular mientras no haya ajustado nada: un ajuste ya movió stock. */
export function validarAnulable(
  toma: Pick<TomaInventario, 'numero' | 'estado'>,
  renglones: Pick<RenglonToma, 'resultado'>[],
  motivo: string,
): string {
  validarQueEstaAbierta(toma, 'anular');
  if (renglones.some((r) => r.resultado === 'AJUSTADO')) {
    throw new ErrorTransicionInvalida(
      `La toma ${toma.numero} ya ajustó stock: no se anula. Se termina de contar y se cierra.`,
    );
  }
  const texto = motivo.trim().replace(/\s+/g, ' ');
  if (texto.length < 3) throw new ErrorDatosInvalidos('Contá por qué se anula la toma.');
  return texto;
}

export interface ResumenToma {
  total: number;
  contados: number;
  sinContar: number;
  /** Contados (y no confirmados todavía) cuyo conteo difiere de lo que figuraba. */
  conDiferencia: number;
  ajustados: number;
  sinDiferencia: number;
  recontar: number;
}

export function resumirToma(
  renglones: Pick<RenglonToma, 'contado' | 'stockAlContar' | 'resultado'>[],
): ResumenToma {
  const contados = renglones.filter((r) => r.contado !== null);
  return {
    total: renglones.length,
    contados: contados.length,
    sinContar: renglones.length - contados.length,
    conDiferencia: contados.filter(
      (r) =>
        !estaResuelto(r) &&
        r.stockAlContar !== null &&
        !mismaCantidad(r.contado as number, r.stockAlContar),
    ).length,
    ajustados: renglones.filter((r) => r.resultado === 'AJUSTADO').length,
    sinDiferencia: renglones.filter((r) => r.resultado === 'SIN_DIFERENCIA').length,
    recontar: renglones.filter((r) => r.resultado === 'RECONTAR').length,
  };
}

/** Dónde está guardado un material: estantería y, si se sabe, la fila. */
export interface Ubicacion {
  estanteriaId: string | null;
  fila: number | null;
}

/**
 * Cambiar de lugar un material mientras se cuenta: pasa seguido que al recorrer
 * el pañol algo aparece en otro estante. Solo con la toma abierta, y a un lugar
 * distinto del que ya tiene.
 */
export function validarReubicacion(
  toma: Pick<TomaInventario, 'numero' | 'estado'>,
  desde: Ubicacion,
  hacia: Ubicacion,
): void {
  validarQueEstaAbierta(toma, 'reubicar materiales');
  if (!hacia.estanteriaId) {
    throw new ErrorDatosInvalidos('Elegí en qué estantería quedó el material.');
  }
  if (desde.estanteriaId === hacia.estanteriaId && desde.fila === hacia.fila) {
    throw new ErrorDatosInvalidos('El material ya está en ese lugar.');
  }
}
