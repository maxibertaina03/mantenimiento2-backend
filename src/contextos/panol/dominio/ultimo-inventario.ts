import { Decimal } from '../../../common/dominio/decimal';

/** Un renglón de una toma ya confirmada, con lo que se contó. */
export interface ConteoEnToma {
  fecha: Date;
  tomaId: string;
  tomaNumero: string;
  contado: Decimal;
  figuraba: Decimal | null;
  /** AJUSTADO o SIN_DIFERENCIA. */
  resultado: string;
  porNombre: string | null;
}

/** Un AJUSTE cargado a mano, fuera de una toma. */
export interface AjusteManual {
  fecha: Date;
  cantidad: Decimal;
  porNombre: string | null;
}

export type UltimoInventario =
  | ({ origen: 'TOMA' } & ConteoEnToma)
  | ({ origen: 'AJUSTE' } & AjusteManual);

/**
 * Cuándo se contó este material por última vez.
 *
 * Cuenta como inventario una toma confirmada —ajustada o sin diferencia— y
 * también un AJUSTE cargado a mano: fijar el stock a un número es haberlo
 * contado. Sin el ajuste, todo lo que se corrigió antes de que existieran las
 * tomas diría «nunca», y no es verdad.
 *
 * Un renglón contado pero sin confirmar, o que quedó para recontar, no cuenta:
 * ese número todavía no se aceptó.
 */
export function ultimoInventario(
  toma: ConteoEnToma | null,
  ajuste: AjusteManual | null,
): UltimoInventario | null {
  if (toma && (!ajuste || toma.fecha >= ajuste.fecha)) return { origen: 'TOMA', ...toma };
  if (ajuste) return { origen: 'AJUSTE', ...ajuste };
  return null;
}
