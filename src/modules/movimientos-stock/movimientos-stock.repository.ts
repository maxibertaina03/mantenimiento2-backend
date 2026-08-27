import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TipoMovimiento } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Decimal, aDecimal } from '../../common/dominio/decimal';
import { MovimientoConRelaciones } from './dto/movimiento-respuesta.dto';
import {
  DatosCrearMovimiento,
  DatosEditarMovimiento,
  EdicionConUsuario,
  FiltroMovimientos,
  RepositorioMovimientos,
} from './movimientos-stock.puerto';

// Re-export por compatibilidad con importadores previos.
export type { DatosCrearMovimiento, DatosEditarMovimiento };

/**
 * Adaptador Prisma del puerto `RepositorioMovimientos`.
 * Es el único lugar del módulo que habla el lenguaje de Prisma.
 */
@Injectable()
export class MovimientosStockRepository implements RepositorioMovimientos {
  constructor(private readonly prisma: PrismaService) {}

  // Incluye los nombres de material/proveedor/usuario y si tuvo ediciones.
  private readonly relaciones = {
    material: { select: { nombre: true } },
    proveedor: { select: { nombre: true } },
    usuario: { select: { nombre: true } },
    _count: { select: { ediciones: true } },
  };

  /** Traduce el filtro de dominio al `where` de Prisma. */
  private aWhere(filtro: FiltroMovimientos): Prisma.MovimientoStockWhereInput {
    return {
      ...(filtro.materialId ? { materialId: filtro.materialId } : {}),
      ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
      ...(filtro.motivo ? { motivo: filtro.motivo } : {}),
      ...(filtro.fechaDesde || filtro.fechaHasta
        ? {
            fecha: {
              ...(filtro.fechaDesde ? { gte: filtro.fechaDesde } : {}),
              ...(filtro.fechaHasta ? { lte: filtro.fechaHasta } : {}),
            },
          }
        : {}),
    };
  }

  /**
   * Lee el stock del material tomando LOCK EXCLUSIVO de la fila (SELECT ... FOR UPDATE).
   *
   * Sin este lock, dos movimientos concurrentes sobre el mismo material leen ambos
   * el stock viejo y el segundo pisa al primero (lost update): dos SALIDAS de 10
   * sobre un stock de 100 dejaban 90 en vez de 80.
   *
   * OJO: el id NO se castea a ::uuid. `String @id @default(uuid())` de Prisma
   * mapea a una columna TEXT, y Postgres no tiene operador `text = uuid`:
   * el cast hacia fallar la query entera con 42883.
   */
  private async leerStockConLock(
    tx: Prisma.TransactionClient,
    materialId: string,
  ): Promise<Decimal> {
    const filas = await tx.$queryRaw<{ stockActual: Prisma.Decimal }[]>`
      SELECT "stockActual" FROM materiales WHERE id = ${materialId} FOR UPDATE
    `;
    if (filas.length === 0) {
      throw new NotFoundException(`No existe el material con id ${materialId}`);
    }
    return aDecimal(filas[0].stockActual);
  }

  async crearConActualizacionDeStock(
    data: DatosCrearMovimiento,
    calcularNuevoStock: (stockActual: Decimal) => Decimal,
  ): Promise<MovimientoConRelaciones> {
    return this.prisma.$transaction(async (tx) => {
      const stockActual = await this.leerStockConLock(tx, data.materialId);

      // Regla de negocio del service; puede lanzar (p. ej. stock insuficiente).
      const nuevoStock = calcularNuevoStock(stockActual);

      const movimiento = await tx.movimientoStock.create({
        data: {
          materialId: data.materialId,
          tipo: data.tipo,
          motivo: data.motivo,
          cantidad: aDecimal(data.cantidad),
          fecha: data.fecha,
          proveedorId: data.proveedorId ?? null,
          usuarioId: data.usuarioId ?? null,
          referenciaTrabajo: data.referenciaTrabajo ?? null,
          notas: data.notas ?? null,
        },
        include: this.relaciones,
      });

      await tx.material.update({
        where: { id: data.materialId },
        data: { stockActual: aDecimal(nuevoStock) },
      });

      return movimiento;
    });
  }

  /**
   * Recalcula el stock del material reproduciendo todos sus movimientos en orden.
   * Devuelve el stock resultante SIN persistirlo, para que el llamador pueda validarlo.
   */
  private async recalcularStock(
    tx: Prisma.TransactionClient,
    materialId: string,
  ): Promise<Decimal> {
    const movs = await tx.movimientoStock.findMany({
      where: { materialId },
      orderBy: [{ fecha: 'asc' }, { creadoEn: 'asc' }],
      select: { tipo: true, cantidad: true },
    });

    let stock = aDecimal(0);
    for (const m of movs) {
      const cantidad = aDecimal(m.cantidad);
      if (m.tipo === TipoMovimiento.ENTRADA) stock = stock.plus(cantidad);
      else if (m.tipo === TipoMovimiento.SALIDA) stock = stock.minus(cantidad);
      else stock = cantidad; // AJUSTE fija el valor absoluto
    }
    return aDecimal(stock);
  }

  async editarConAuditoria(params: {
    id: string;
    materialId: string;
    datos: DatosEditarMovimiento;
    edicion: { usuarioId: string | null; motivo: string; cambios: unknown };
    validarStock: (stockRecalculado: Decimal) => void;
  }): Promise<MovimientoConRelaciones> {
    const { id, materialId, datos, edicion, validarStock } = params;

    return this.prisma.$transaction(async (tx) => {
      // Lock del material: la edición también recalcula stock y compite con las altas.
      await this.leerStockConLock(tx, materialId);

      await tx.movimientoStock.update({
        where: { id },
        data: {
          tipo: datos.tipo,
          motivo: datos.motivo,
          cantidad: aDecimal(datos.cantidad),
          fecha: datos.fecha,
          proveedorId: datos.proveedorId,
          referenciaTrabajo: datos.referenciaTrabajo,
          notas: datos.notas,
        },
      });

      const nuevoStock = await this.recalcularStock(tx, materialId);

      // Si el recálculo deja el stock inválido (negativo), la transacción se aborta
      // entera: ni la edición ni la auditoría quedan persistidas.
      validarStock(nuevoStock);

      await tx.material.update({
        where: { id: materialId },
        data: { stockActual: nuevoStock },
      });

      await tx.edicionMovimiento.create({
        data: {
          movimientoId: id,
          usuarioId: edicion.usuarioId,
          motivo: edicion.motivo,
          cambios: edicion.cambios as Prisma.InputJsonValue,
        },
      });

      return tx.movimientoStock.findUniqueOrThrow({ where: { id }, include: this.relaciones });
    });
  }

  listarEdiciones(movimientoId: string): Promise<EdicionConUsuario[]> {
    return this.prisma.edicionMovimiento.findMany({
      where: { movimientoId },
      orderBy: { creadoEn: 'desc' },
      include: { usuario: { select: { nombre: true } } },
    });
  }

  buscarConFiltros(
    filtro: FiltroMovimientos,
    skip: number,
    take: number,
  ): Promise<MovimientoConRelaciones[]> {
    return this.prisma.movimientoStock.findMany({
      where: this.aWhere(filtro),
      skip,
      take,
      orderBy: { fecha: 'desc' },
      include: this.relaciones,
    });
  }

  contar(filtro: FiltroMovimientos): Promise<number> {
    return this.prisma.movimientoStock.count({ where: this.aWhere(filtro) });
  }

  buscarPorId(id: string): Promise<MovimientoConRelaciones | null> {
    return this.prisma.movimientoStock.findUnique({
      where: { id },
      include: this.relaciones,
    });
  }
}
