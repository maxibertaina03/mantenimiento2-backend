import { claseDelRenglon, unidadesDeEquipo } from '../../../common/dominio/renglon-de-compra';
import type { RenglonComprado } from '../../../common/dominio/renglon-de-compra';
import { ErrorDatosInvalidos, ErrorEstadoDeLaOrden, ErrorSinComprobante } from './errores';

/**
 * Las reglas de una orden de compra.
 *
 * El ciclo de vida, qué se puede cambiar en cada estado y qué hace falta para
 * cerrarla. Vivían mezcladas con Nest en el service; acá son funciones puras.
 * Los mensajes son los mismos, palabra por palabra.
 */

export type EstadoOrdenCompra = 'BORRADOR' | 'EMITIDA' | 'RECIBIDA' | 'ANULADA';

/**
 * Transiciones de estado permitidas.
 * BORRADOR → EMITIDA → RECIBIDA. Desde borrador o emitida se puede anular;
 * una orden RECIBIDA ya movió stock, así que es terminal.
 */
export const TRANSICIONES: Record<EstadoOrdenCompra, EstadoOrdenCompra[]> = {
  BORRADOR: ['EMITIDA', 'ANULADA'],
  EMITIDA: ['RECIBIDA', 'ANULADA'],
  RECIBIDA: [],
  ANULADA: [],
};

/** Lo mínimo que hace falta saber de una orden para decidir sobre ella. */
export interface OrdenEnEstado {
  numero: string;
  estado: EstadoOrdenCompra;
}

/** Valida la transición y da un mensaje que explica por qué no se puede. */
export function validarTransicion(orden: OrdenEnEstado, destino: EstadoOrdenCompra): void {
  if (!TRANSICIONES[orden.estado].includes(destino)) {
    throw new ErrorEstadoDeLaOrden(
      `La orden ${orden.numero} está ${orden.estado} y no puede pasar a ${destino}.`,
    );
  }
}

/** Solo se editan las órdenes en BORRADOR: una que ya salió tiene que coincidir con su PDF. */
export function validarEditable(orden: OrdenEnEstado): void {
  if (orden.estado !== 'BORRADOR') {
    throw new ErrorEstadoDeLaOrden(
      `La orden ${orden.numero} está ${orden.estado} y ya no se puede editar. ` +
        'Solo se editan las órdenes en BORRADOR.',
    );
  }
}

/** Solo se borra un BORRADOR. Lo demás se anula, para conservar el registro. */
export function validarEliminable(orden: OrdenEnEstado): void {
  if (orden.estado !== 'BORRADOR') {
    throw new ErrorEstadoDeLaOrden(
      `Solo se pueden eliminar órdenes en BORRADOR. La orden ${orden.numero} está ${orden.estado}; ` +
        'si ya no corresponde, anulala para conservar el registro.',
    );
  }
}

/** Editar no puede dejar la orden vacía. */
export function validarQueQuedanRenglones(renglones: unknown[] | undefined): void {
  if (renglones && renglones.length === 0) {
    throw new ErrorDatosInvalidos('La orden debe tener al menos un renglón.');
  }
}

/** Emitir una orden sin renglones es mandarle al proveedor una hoja en blanco. */
export function validarQueSePuedeEmitir(renglones: unknown[] | undefined): void {
  if (!renglones?.length) {
    throw new ErrorDatosInvalidos('No se puede emitir una orden sin renglones.');
  }
}

/**
 * Revisa los renglones y devuelve los materiales a validar, en orden.
 *
 * Cada renglón dice qué se compra, y una sola cosa; eso corta acá y no al
 * recibir, cuando ya no se puede deshacer nada. Un equipo va por unidades
 * enteras y puede repetirse —dos compras distintas del mismo modelo—. Un
 * material no: dos veces en la misma orden confunde al proveedor y duplica el
 * movimiento de stock.
 *
 * Los materiales se devuelven a medida que aparecen, para que quien llama los
 * busque en el mismo orden que antes.
 */
export function* materialesDeLosRenglones(
  renglones: (RenglonComprado & { materialId?: string | null })[],
): Generator<string> {
  const vistos = new Set<string>();
  for (const renglon of renglones) {
    const clase = claseDelRenglon(renglon);

    if (clase === 'equipo') {
      unidadesDeEquipo(renglon);
      continue;
    }

    const materialId = renglon.materialId as string;
    if (vistos.has(materialId)) {
      throw new ErrorDatosInvalidos(
        'La orden tiene el mismo material en más de un renglón. Unificalos en uno solo.',
      );
    }
    vistos.add(materialId);
    yield materialId;
  }
}

/** Con qué papel se cerró la orden. */
export interface Comprobante {
  remito: string | null;
  factura: string | null;
  /** Lo que queda en cada movimiento: desde el stock se llega a la orden y al papel. */
  referencia: string;
}

/**
 * Sin comprobante no se cierra la orden.
 *
 * Es lo único que ata la entrada de stock al papel que quedó en la empresa:
 * sin eso, una diferencia de inventario no se puede reconstruir contra nada.
 * La regla vive en el dominio y no solo en el DTO para que valga también si
 * mañana la recepción entra por otro lado (una importación, un script).
 */
export function comprobanteDeRecepcion(
  numero: string,
  remitoCargado: string | null | undefined,
  facturaCargada: string | null | undefined,
): Comprobante {
  const remito = remitoCargado?.trim() || null;
  const factura = facturaCargada?.trim() || null;
  if (!remito && !factura) {
    throw new ErrorSinComprobante(
      `Para cerrar la orden ${numero} hace falta el número de remito o el de ` +
        'factura del proveedor. Es lo que después permite cruzar el stock con el papel.',
    );
  }

  const papel = [remito ? `Remito ${remito}` : null, factura ? `Factura ${factura}` : null]
    .filter(Boolean)
    .join(' · ');
  return { remito, factura, referencia: `${numero} · ${papel}` };
}

/** El precio de un renglón, corregido después de emitir o de recibir. */
export interface PrecioCorregido {
  renglonId: string;
  precioUnitario: number;
}

/**
 * Los precios son lo único que se corrige en una orden que ya salió.
 *
 * Pasa que se emite o se recibe una orden con un renglón sin precio, y el
 * proveedor la pide de nuevo con todo. Cantidades y materiales no se tocan:
 * en una orden recibida ya son stock. El precio no: vive solo en el renglón,
 * el movimiento de stock no lo copia, así que corregirlo no mueve nada.
 *
 * Una anulada no: no va a salir más a ningún lado.
 */
export function validarPreciosCorregibles(orden: OrdenEnEstado): void {
  if (orden.estado === 'ANULADA') {
    throw new ErrorEstadoDeLaOrden(
      `La orden ${orden.numero} está ANULADA: no se le corrigen precios.`,
    );
  }
}

/** Cada precio tiene que ser de un renglón de esta orden, una sola vez, y mayor que cero. */
export function validarPreciosCorregidos(
  renglonesDeLaOrden: { id: string }[],
  precios: PrecioCorregido[],
): void {
  if (precios.length === 0) {
    throw new ErrorDatosInvalidos('No llegó ningún precio para corregir.');
  }
  const deLaOrden = new Set(renglonesDeLaOrden.map((r) => r.id));
  const vistos = new Set<string>();
  for (const p of precios) {
    if (!deLaOrden.has(p.renglonId)) {
      throw new ErrorDatosInvalidos('Uno de los renglones no es de esta orden.');
    }
    if (vistos.has(p.renglonId)) {
      throw new ErrorDatosInvalidos('El mismo renglón vino dos veces.');
    }
    vistos.add(p.renglonId);
    if (!(p.precioUnitario > 0)) {
      throw new ErrorDatosInvalidos('El precio tiene que ser mayor que cero.');
    }
  }
}
