import { Injectable } from '@nestjs/common';
import { MotivoMovimiento, TipoMovimiento } from '@prisma/client';
import { MovimientosStockService } from '../../../modules/movimientos-stock/movimientos-stock.service';
import { DatosUsoDeMaterial, Stock } from '../puertos/stock';

/**
 * El pañol de verdad: el módulo de movimientos de stock.
 *
 * Pasa por su service y no por su repositorio a propósito. El service es el que
 * tiene las reglas —no dejar el stock negativo, no cargar sobre un material
 * jubilado, no meter un movimiento por detrás de un ajuste— y saltearlas
 * significaría que una salida hecha desde una orden de trabajo puede lo que una
 * salida hecha a mano no puede. Dos caminos con reglas distintas hacia la misma
 * tabla es como se rompe un stock.
 */
@Injectable()
export class StockPorMovimientos implements Stock {
  constructor(private readonly movimientos: MovimientosStockService) {}

  async descontarPorTrabajo(datos: DatosUsoDeMaterial): Promise<{ movimientoId: string }> {
    const movimiento = await this.movimientos.crear(
      {
        materialId: datos.materialId,
        tipo: TipoMovimiento.SALIDA,
        motivo: MotivoMovimiento.TRABAJO,
        cantidad: datos.cantidad,
        // El número de la orden va en la referencia, así el movimiento se lee
        // solo en el historial del material: "OT-2026-0001" y listo.
        referenciaTrabajo: datos.numeroOrden,
        notas: datos.notas ?? undefined,
      },
      datos.usuarioId ?? undefined,
    );

    return { movimientoId: movimiento.id };
  }

  async devolverPorTrabajo(datos: DatosUsoDeMaterial): Promise<{ movimientoId: string }> {
    const movimiento = await this.movimientos.crear(
      {
        materialId: datos.materialId,
        tipo: TipoMovimiento.ENTRADA,
        // OTRO y no DEVOLUCION: en este sistema DEVOLUCION es una salida, lo
        // que se le devuelve a un proveedor. Esto es lo contrario, algo que
        // vuelve al pañol, y el motivo tiene que decir la verdad aunque el
        // nombre suene menos preciso. La nota aclara de qué orden volvió.
        motivo: MotivoMovimiento.OTRO,
        cantidad: datos.cantidad,
        referenciaTrabajo: datos.numeroOrden,
        notas: `Vuelve al pañol desde ${datos.numeroOrden}. ${datos.notas ?? ''}`.trim(),
      },
      datos.usuarioId ?? undefined,
    );

    return { movimientoId: movimiento.id };
  }
}
