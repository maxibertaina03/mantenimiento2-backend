import { ErrorNoEncontrado } from '../dominio/errores';
import { validarCantidadUsada, validarQueAceptaMateriales } from '../dominio/orden-trabajo';
import {
  MaterialUsadoConRelaciones,
  RepositorioOrdenesTrabajo,
} from '../puertos/repositorio-ordenes-trabajo';
import { Stock } from '../puertos/stock';

export interface DatosMaterialUsado {
  materialId: string;
  cantidad: number;
  notas?: string | null;
}

/**
 * Cargar y quitar los materiales que consumió un trabajo.
 *
 * Es el caso de uso que justifica el módulo entero: cargar un material acá no
 * anota un número al costado, saca el material del pañol de verdad. El renglón
 * de la orden y el movimiento de stock nacen juntos y quedan atados por el id
 * del movimiento, así que no hay forma de que uno diga una cosa y el otro otra.
 *
 * Son dos almacenes distintos y no hay transacción que los abarque, así que
 * cada operación deshace la mitad que alcanzó a hacer si la otra falla. No es
 * elegante, pero la alternativa —dejar que fallen por separado— termina en un
 * pañol descontado sin ninguna orden que lo explique, que es justo lo que este
 * módulo viene a evitar.
 */
export class UsarMateriales {
  constructor(
    private readonly repo: RepositorioOrdenesTrabajo,
    private readonly stock: Stock,
  ) {}

  async agregar(
    ordenId: string,
    datos: DatosMaterialUsado,
    usuarioId: string | null,
  ): Promise<MaterialUsadoConRelaciones> {
    const orden = await this.repo.buscarPorId(ordenId);
    if (!orden) throw new ErrorNoEncontrado(`No existe la orden de trabajo con id ${ordenId}`);

    validarQueAceptaMateriales(orden);
    validarCantidadUsada(datos.cantidad);

    // El stock se mueve PRIMERO, y es a propósito. Al revés, un fallo del pañol
    // —no alcanza el stock, el material está jubilado— dejaría la orden
    // diciendo que usó algo que nunca salió.
    const { movimientoId } = await this.stock.descontarPorTrabajo({
      materialId: datos.materialId,
      cantidad: datos.cantidad,
      numeroOrden: orden.numero,
      usuarioId,
      notas: datos.notas ?? null,
    });

    try {
      return await this.repo.agregarMaterial({
        ordenTrabajoId: ordenId,
        materialId: datos.materialId,
        cantidad: datos.cantidad,
        movimientoId,
        registradoPorId: usuarioId,
      });
    } catch (error) {
      // El descuento quedó sin dueño: se devuelve, o el pañol arrastraría una
      // salida que ninguna orden reclama.
      await this.stock.devolverPorTrabajo({
        materialId: datos.materialId,
        cantidad: datos.cantidad,
        numeroOrden: orden.numero,
        usuarioId,
        notas: 'No se pudo guardar el renglón en la orden.',
      });
      throw error;
    }
  }

  async quitar(materialUsadoId: string, usuarioId: string | null): Promise<void> {
    const usado = await this.repo.buscarMaterialUsado(materialUsadoId);
    if (!usado) throw new ErrorNoEncontrado(`No existe el material usado ${materialUsadoId}`);

    const orden = await this.repo.buscarPorId(usado.ordenTrabajoId);
    if (!orden) throw new ErrorNoEncontrado(`No existe la orden de trabajo de ese material`);

    validarQueAceptaMateriales(orden);

    await this.repo.quitarMaterial(materialUsadoId);

    try {
      await this.stock.devolverPorTrabajo({
        materialId: usado.materialId,
        cantidad: usado.cantidad,
        numeroOrden: orden.numero,
        usuarioId,
        notas: 'Se quitó de la orden.',
      });
    } catch (error) {
      // El renglón vuelve. Si no, la orden diría que no usó el material y el
      // pañol seguiría descontado, sin nada que explique la diferencia. Vuelve
      // con otro id, que es cosmético al lado de perder el rastro.
      await this.repo.agregarMaterial({
        ordenTrabajoId: usado.ordenTrabajoId,
        materialId: usado.materialId,
        cantidad: usado.cantidad,
        movimientoId: usado.movimientoId,
        registradoPorId: usado.registradoPorId,
      });
      throw error;
    }
  }
}
