import { Decimal } from '../../../common/dominio/decimal';
import {
  ErrorDatosInvalidos,
  ErrorNoAutorizado,
  ErrorStockInsuficiente,
  ErrorStockNegativo,
} from './errores';

/**
 * Las reglas de un movimiento de stock.
 *
 * Es el corazón del pañol: cómo cambia el stock con cada tipo de movimiento y
 * qué nunca puede pasar —que quede negativo, que un motivo no encaje con su
 * tipo—. Vivían mezcladas con Nest en el service; acá son funciones puras, y se
 * prueban sin levantar nada.
 *
 * Los mensajes son los mismos, palabra por palabra: los lee quien carga, y la
 * pantalla los muestra tal cual.
 */

/** ENTRADA suma, SALIDA resta, AJUSTE fija el valor absoluto. */
export type TipoMovimiento = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

export type MotivoMovimiento = 'COMPRA' | 'TRABAJO' | 'AJUSTE' | 'DEVOLUCION' | 'OTRO';

/**
 * Motivos válidos según el tipo de movimiento.
 * - ENTRADA suma stock: COMPRA u OTRO.
 * - SALIDA resta stock: TRABAJO, DEVOLUCION (al proveedor) u OTRO.
 * - AJUSTE fija el stock: AJUSTE u OTRO.
 */
export const MOTIVOS_POR_TIPO: Record<TipoMovimiento, MotivoMovimiento[]> = {
  ENTRADA: ['COMPRA', 'OTRO'],
  SALIDA: ['TRABAJO', 'DEVOLUCION', 'OTRO'],
  AJUSTE: ['AJUSTE', 'OTRO'],
};

/** Invariante compartida por alta y edición: el motivo debe encajar con el tipo. */
export function validarTipoYMotivo(tipo: TipoMovimiento, motivo: MotivoMovimiento): void {
  const motivosValidos = MOTIVOS_POR_TIPO[tipo];
  if (!motivosValidos.includes(motivo)) {
    throw new ErrorDatosInvalidos(
      `El motivo ${motivo} no corresponde a un movimiento de tipo ${tipo}. ` +
        `Motivos válidos: ${motivosValidos.join(', ')}.`,
    );
  }
}

/** ENTRADA/SALIDA deben mover una cantidad > 0 (no tendría sentido 0). */
export function validarCantidad(tipo: TipoMovimiento, cantidad: Decimal): void {
  if (tipo !== 'AJUSTE' && cantidad.lessThanOrEqualTo(0)) {
    throw new ErrorDatosInvalidos('La cantidad debe ser mayor a 0 para ENTRADA y SALIDA.');
  }
}

/**
 * Cómo queda el stock después de un movimiento nuevo.
 *
 * Toda la aritmética es Decimal para no arrastrar error de punto flotante.
 */
export function calcularNuevoStock(
  tipo: TipoMovimiento,
  stockActual: Decimal,
  cantidad: Decimal,
): Decimal {
  switch (tipo) {
    case 'ENTRADA':
      return stockActual.plus(cantidad);
    case 'SALIDA': {
      const resultado = stockActual.minus(cantidad);
      if (resultado.isNegative()) {
        throw new ErrorStockInsuficiente(
          `Stock insuficiente: hay ${stockActual.toString()} y se intentan retirar ` +
            `${cantidad.toString()}. Usá un movimiento de tipo AJUSTE si necesitás corregir el stock.`,
        );
      }
      return resultado;
    }
    case 'AJUSTE':
      // El AJUSTE fija el stock al valor absoluto de `cantidad` (>= 0 por el DTO).
      return cantidad;
    default:
      throw new ErrorDatosInvalidos('Tipo de movimiento no soportado.');
  }
}

/**
 * Misma invariante que en el alta, para la edición: el historial recalculado no
 * puede dejar el stock negativo.
 */
export function validarStockRecalculado(stockRecalculado: Decimal): void {
  if (stockRecalculado.isNegative()) {
    throw new ErrorStockNegativo(
      `Esta edición dejaría el stock del material en ${stockRecalculado.toString()}. ` +
        `Revisá el historial de movimientos antes de corregir.`,
    );
  }
}

/** Quién está editando: alcanza con saber quién es y si es admin. */
export interface QuienEdita {
  id: string;
  rol: string;
}

/**
 * Un movimiento lo corrige quien lo registró, o un admin.
 *
 * Sin nadie identificado —en desarrollo, sin auth— se permite: así era antes.
 */
export function validarQuePuedeEditar(
  registradoPorId: string | null,
  quien: QuienEdita | undefined,
): void {
  if (!quien) return;
  const esCreador = registradoPorId === quien.id;
  const esAdmin = quien.rol === 'ADMIN';
  if (!esCreador && !esAdmin) {
    throw new ErrorNoAutorizado('Solo quien registró el movimiento (o un admin) puede editarlo.');
  }
}
