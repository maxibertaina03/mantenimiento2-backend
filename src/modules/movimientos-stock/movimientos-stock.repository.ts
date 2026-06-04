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

  // Incluye los nombres de material/proveedor/usuario para listar y exportar.
  private readonly relaciones = {
    material: { select: { nombre: true } },
    proveedor: { select: { nombre: true } },
    usuario: { select: { nombre: true } },
  };

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
