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

export type EstadoOrdenCompra =
  | 'BORRADOR'
  | 'EMITIDA'
  | 'RECIBIDA_PARCIAL'
  | 'RECIBIDA'
  | 'ANULADA';

/**
 * Transiciones de estado permitidas.
 * BORRADOR → EMITIDA → (RECIBIDA_PARCIAL →) RECIBIDA. Desde borrador o emitida
 * se puede anular. Una orden que recibió algo ya movió stock: no se anula, se
 * completa o se cierra con faltante (que la deja RECIBIDA).
 */
export const TRANSICIONES: Record<EstadoOrdenCompra, EstadoOrdenCompra[]> = {
  BORRADOR: ['EMITIDA', 'ANULADA'],
  EMITIDA: ['RECIBIDA', 'RECIBIDA_PARCIAL', 'ANULADA'],
  RECIBIDA_PARCIAL: ['RECIBIDA_PARCIAL', 'RECIBIDA'],
  RECIBIDA: [],
  ANULADA: [],
};

/** Los estados en los que todavía se espera mercadería. */
export function esperaMercaderia(estado: EstadoOrdenCompra): boolean {
  return estado === 'EMITIDA' || estado === 'RECIBIDA_PARCIAL';
}

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

// ─────────────────── Recepción en varias entregas ───────────────────

/** Lo que hace falta saber de un renglón para recibirlo. */
export interface RenglonARecibir {
  id: string;
  cantidad: number;
  cantidadRecibida: number;
  /** Un renglón de equipo se recibe por unidades enteras: cada una es una ficha. */
  esEquipo: boolean;
  nombre: string;
}

/** Lo que llegó de un renglón en una entrega. */
export interface CantidadRecibida {
  renglonId: string;
  cantidad: number;
}

/** Las cantidades se comparan con 3 decimales, como se guardan. */
const redondear = (n: number) => Math.round(n * 1000) / 1000;

/** Lo que falta recibir de un renglón. */
export function pendienteDe(renglon: { cantidad: number; cantidadRecibida: number }): number {
  return Math.max(0, redondear(renglon.cantidad - renglon.cantidadRecibida));
}

/** Los renglones a los que todavía les falta algo, con cuánto. */
export function pendientesDe<R extends { cantidad: number; cantidadRecibida: number }>(
  renglones: R[],
): (R & { pendiente: number })[] {
  return renglones.map((r) => ({ ...r, pendiente: pendienteDe(r) })).filter((r) => r.pendiente > 0);
}

/**
 * Qué llega en esta entrega.
 *
 * Sin detalle, llega todo lo que faltaba: es la recepción de siempre, la de
 * una orden que llegó completa. Con detalle, cada cantidad tiene que ser de
 * un renglón de la orden, mayor que cero y no más de lo que falta: recibir de
 * más inflaría el stock con algo que no se compró.
 */
export function cantidadesARecibir(
  numero: string,
  renglones: RenglonARecibir[],
  pedidas?: CantidadRecibida[],
): CantidadRecibida[] {
  const aRecibir = pedidas
    ? pedidas.filter((p) => p.cantidad !== 0)
    : pendientesDe(renglones).map((r) => ({ renglonId: r.id, cantidad: r.pendiente }));

  if (aRecibir.length === 0) {
    throw new ErrorDatosInvalidos(
      pedidas
        ? 'Indicá qué llegó: al menos un renglón con una cantidad mayor que cero.'
        : `La orden ${numero} no tiene nada pendiente de recibir.`,
    );
  }

  const porId = new Map(renglones.map((r) => [r.id, r]));
  const vistos = new Set<string>();
  for (const p of aRecibir) {
    const renglon = porId.get(p.renglonId);
    if (!renglon) throw new ErrorDatosInvalidos('Uno de los renglones no es de esta orden.');
    if (vistos.has(p.renglonId)) throw new ErrorDatosInvalidos('El mismo renglón vino dos veces.');
    vistos.add(p.renglonId);

    if (!(p.cantidad > 0)) {
      throw new ErrorDatosInvalidos(
        `La cantidad de «${renglon.nombre}» tiene que ser mayor que cero.`,
      );
    }
    if (renglon.esEquipo && !Number.isInteger(p.cantidad)) {
      throw new ErrorDatosInvalidos(
        `«${renglon.nombre}» es un equipo: se recibe por unidades enteras, cada una es una ficha.`,
      );
    }
    const falta = pendienteDe(renglon);
    if (redondear(p.cantidad) > falta) {
      throw new ErrorDatosInvalidos(
        falta === 0
          ? `«${renglon.nombre}» ya se recibió completo.`
          : `De «${renglon.nombre}» faltan ${falta} y se quieren recibir ${p.cantidad}. ` +
              'No se puede recibir más de lo que se pidió.',
      );
    }
  }
  return aRecibir;
}

/** Después de esta entrega, ¿llegó todo o queda algo? */
export function estadoTrasRecibir(
  renglones: RenglonARecibir[],
  recibidas: CantidadRecibida[],
): 'RECIBIDA' | 'RECIBIDA_PARCIAL' {
  const ahora = new Map(recibidas.map((r) => [r.renglonId, r.cantidad]));
  const quedaAlgo = renglones.some(
    (r) => pendienteDe({ ...r, cantidadRecibida: r.cantidadRecibida + (ahora.get(r.id) ?? 0) }) > 0,
  );
  return quedaAlgo ? 'RECIBIDA_PARCIAL' : 'RECIBIDA';
}

/**
 * Cerrar una orden con lo que llegó: el proveedor no va a entregar el resto.
 *
 * Solo una que recibió una parte (si no llegó nada, se anula). Pide el
 * motivo, porque una orden cerrada con faltante sin explicación no se
 * entiende dentro de seis meses.
 */
export function validarCierreConFaltante(orden: OrdenEnEstado, motivo: string): string {
  if (orden.estado !== 'RECIBIDA_PARCIAL') {
    throw new ErrorEstadoDeLaOrden(
      orden.estado === 'EMITIDA'
        ? `La orden ${orden.numero} no recibió nada todavía: si no va a llegar, anulala.`
        : `La orden ${orden.numero} está ${orden.estado}: solo se cierra con faltante una que recibió una parte.`,
    );
  }
  const limpio = motivo.trim().replace(/\s+/g, ' ');
  if (limpio.length < 3) {
    throw new ErrorDatosInvalidos(
      'Contá por qué se cierra con faltante (por ejemplo, «el proveedor no tiene stock»).',
    );
  }
  return limpio.slice(0, 300);
}

/** Reclamarle al proveedor solo tiene sentido si se espera algo de él. */
export function validarReclamable(orden: OrdenEnEstado, pendientes: unknown[]): void {
  if (!esperaMercaderia(orden.estado) || pendientes.length === 0) {
    throw new ErrorEstadoDeLaOrden(
      `La orden ${orden.numero} no tiene nada pendiente de entrega para reclamar.`,
    );
  }
}
