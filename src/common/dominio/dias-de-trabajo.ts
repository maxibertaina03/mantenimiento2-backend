import { ErrorDatosInvalidos } from './errores';

/**
 * Qué días de la semana se trabaja: 0 domingo, 1 lunes … 6 sábado (como
 * `Date.getUTCDay`).
 *
 * La planta no trabaja sábados ni domingos: una purga diaria hecha el viernes
 * no puede quedar para el sábado. Cada plan y cada rutina dice sus días, y por
 * defecto son de lunes a viernes.
 */
export const LUNES_A_VIERNES: readonly number[] = [1, 2, 3, 4, 5];
export const TODOS_LOS_DIAS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

class ErrorDiasInvalidos extends ErrorDatosInvalidos {}

/** Los días, ordenados y sin repetir. Rechaza una lista vacía o un día que no existe. */
export function validarDiasSemana(dias: readonly number[] | null | undefined): number[] {
  if (dias === undefined || dias === null) return [...LUNES_A_VIERNES];
  const limpios = [...new Set(dias)].sort((a, b) => a - b);
  if (limpios.length === 0) {
    throw new ErrorDiasInvalidos('Elegí al menos un día de la semana en que se hace.');
  }
  if (limpios.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new ErrorDiasInvalidos('Los días de la semana van de 0 (domingo) a 6 (sábado).');
  }
  return limpios;
}

/** Si ese día (solo la fecha, en UTC) es de trabajo. */
export function esDiaDeTrabajo(fecha: Date, dias: readonly number[]): boolean {
  return dias.includes(fecha.getUTCDay());
}

/**
 * La misma fecha si es día de trabajo; si no, el siguiente que sí.
 *
 * Con una lista vacía devuelve la fecha tal cual: no debería pasar (se valida
 * al guardar), y un bucle sin fin sería peor que un día de más.
 */
export function alSiguienteDiaDeTrabajo(fecha: Date, dias: readonly number[]): Date {
  const salida = new Date(fecha.getTime());
  if (dias.length === 0) return salida;
  for (let i = 0; i < 7 && !esDiaDeTrabajo(salida, dias); i += 1) {
    salida.setUTCDate(salida.getUTCDate() + 1);
  }
  return salida;
}
