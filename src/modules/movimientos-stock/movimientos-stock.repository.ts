import { Injectable, NotFoundException } from '@nestjs/common';
import { MotivoMovimiento, MovimientoStock, Prisma, TipoMovimiento } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface DatosCrearMovimiento {
  materialId: string;
  tipo: TipoMovimiento;
  motivo: MotivoMovimiento;
  cantidad: number;
  fecha?: Date;
  proveedorId?: string | null;
  usuarioId?: string | null;
  referenciaTrabajo?: string | null;
  notas?: string | null;
}

export interface DatosEditarMovimiento {
  tipo: TipoMovimiento;
  motivo: MotivoMovimiento;
  cantidad: number;
  fecha: Date;
  proveedorId: string | null;
  referenciaTrabajo: string | null;
  notas: string | null;
}

@Injectable()
export class MovimientosStockRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea el movimiento y actualiza el stockActual del material en UNA transacción.
   * - Lee el stock vigente dentro de la transacción (consistencia).
   * - `calcularNuevoStock` (definido por el service) aplica la regla de negocio
   *   y puede lanzar si el resultado es inválido (p. ej. stock negativo).
   */
  async crearConActualizacionDeStock(
    data: DatosCrearMovimiento,
    calcularNuevoStock: (stockActual: number) => number,
  ): Promise<MovimientoStock> {
    return this.prisma.$transaction(async (tx) => {
      const material = await tx.material.findUnique({ where: { id: data.materialId } });
      if (!material) {
        throw new NotFoundException(`No existe el material con id ${data.materialId}`);
      }

      const nuevoStock = calcularNuevoStock(Number(material.stockActual));

      const movimiento = await tx.movimientoStock.create({
        data: {
          materialId: data.materialId,
          tipo: data.tipo,
          motivo: data.motivo,
          cantidad: new Prisma.Decimal(data.cantidad),
          fecha: data.fecha,
          proveedorId: data.proveedorId ?? null,
          usuarioId: data.usuarioId ?? null,
          referenciaTrabajo: data.referenciaTrabajo ?? null,
          notas: data.notas ?? null,
        },
      });

      await tx.material.update({
        where: { id: data.materialId },
        data: { stockActual: new Prisma.Decimal(nuevoStock) },
      });

      return movimiento;
    });
  }

  // Incluye los nombres de material/proveedor/usuario y si tuvo ediciones.
  private readonly relaciones = {
    material: { select: { nombre: true } },
    proveedor: { select: { nombre: true } },
    usuario: { select: { nombre: true } },
    _count: { select: { ediciones: true } },
  };

  /** Recalcula el stock del material reproduciendo todos sus movimientos en orden. */
  private async recalcularStock(tx: Prisma.TransactionClient, materialId: string): Promise<void> {
    const movs = await tx.movimientoStock.findMany({
      where: { materialId },
      orderBy: [{ fecha: 'asc' }, { creadoEn: 'asc' }],
      select: { tipo: true, cantidad: true },
    });
    let stock = 0;
    for (const m of movs) {
      const c = Number(m.cantidad);
      if (m.tipo === 'ENTRADA') stock += c;
      else if (m.tipo === 'SALIDA') stock -= c;
      else stock = c; // AJUSTE fija el valor absoluto
    }
    await tx.material.update({
      where: { id: materialId },
      data: { stockActual: new Prisma.Decimal(stock) },
    });
  }

  /**
   * Edita un movimiento, recalcula el stock del material y deja el registro de
   * auditoría (motivo + antes/después), todo en una transacción.
   */
  async editarConAuditoria(params: {
    id: string;
    materialId: string;
    datos: DatosEditarMovimiento;
    edicion: { usuarioId: string | null; motivo: string; cambios: Prisma.InputJsonValue };
  }) {
    const { id, materialId, datos, edicion } = params;
    return this.prisma.$transaction(async (tx) => {
      await tx.movimientoStock.update({
        where: { id },
        data: {
          tipo: datos.tipo,
          motivo: datos.motivo,
          cantidad: new Prisma.Decimal(datos.cantidad),
          fecha: datos.fecha,
          proveedorId: datos.proveedorId,
          referenciaTrabajo: datos.referenciaTrabajo,
          notas: datos.notas,
        },
      });

      await this.recalcularStock(tx, materialId);

      await tx.edicionMovimiento.create({
        data: {
          movimientoId: id,
          usuarioId: edicion.usuarioId,
          motivo: edicion.motivo,
          cambios: edicion.cambios,
        },
      });

      return tx.movimientoStock.findUniqueOrThrow({ where: { id }, include: this.relaciones });
    });
  }

  listarEdiciones(movimientoId: string) {
    return this.prisma.edicionMovimiento.findMany({
      where: { movimientoId },
      orderBy: { creadoEn: 'desc' },
      include: { usuario: { select: { nombre: true } } },
    });
  }

  buscarConFiltros(where: Prisma.MovimientoStockWhereInput, skip: number, take: number) {
    return this.prisma.movimientoStock.findMany({
      where,
      skip,
      take,
      orderBy: { fecha: 'desc' },
      include: this.relaciones,
    });
  }

  contar(where: Prisma.MovimientoStockWhereInput): Promise<number> {
    return this.prisma.movimientoStock.count({ where });
  }

  buscarPorId(id: string) {
    return this.prisma.movimientoStock.findUnique({
      where: { id },
      include: this.relaciones,
    });
  }
}
