import { DatosUsoDeMaterial, Stock } from '../puertos/stock';

/** Un movimiento anotado por el pañol de mentira, para revisarlo en el test. */
export interface AsientoDePrueba extends DatosUsoDeMaterial {
  sentido: 'SALIDA' | 'ENTRADA';
  movimientoId: string;
}

/**
 * El pañol de los tests.
 *
 * Lleva la cuenta de lo que se descontó y de lo que se devolvió, que es
 * exactamente lo que hay que mirar para saber si una compensación ocurrió.
 */
export class StockEnMemoria implements Stock {
  readonly asientos: AsientoDePrueba[] = [];
  private contador = 0;

  /** Hace fallar el próximo descuento, como cuando no alcanza el stock. */
  fallarAlDescontar = false;
  /** Hace fallar la próxima devolución. */
  fallarAlDevolver = false;

  async descontarPorTrabajo(datos: DatosUsoDeMaterial): Promise<{ movimientoId: string }> {
    if (this.fallarAlDescontar) {
      this.fallarAlDescontar = false;
      throw new Error('No hay stock suficiente.');
    }
    this.contador += 1;
    const movimientoId = `mov-${this.contador}`;
    this.asientos.push({ ...datos, sentido: 'SALIDA', movimientoId });
    return { movimientoId };
  }

  async devolverPorTrabajo(datos: DatosUsoDeMaterial): Promise<{ movimientoId: string }> {
    if (this.fallarAlDevolver) {
      this.fallarAlDevolver = false;
      throw new Error('No se pudo devolver al pañol.');
    }
    this.contador += 1;
    const movimientoId = `mov-${this.contador}`;
    this.asientos.push({ ...datos, sentido: 'ENTRADA', movimientoId });
    return { movimientoId };
  }

  /** Lo que quedó fuera del pañol: salidas menos devoluciones, por material. */
  saldoFueraDelPanol(materialId: string): number {
    return this.asientos
      .filter((a) => a.materialId === materialId)
      .reduce((suma, a) => suma + (a.sentido === 'SALIDA' ? a.cantidad : -a.cantidad), 0);
  }
}
