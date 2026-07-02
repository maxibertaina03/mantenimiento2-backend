import { Injectable } from '@nestjs/common';
import { CategoriaMaterial, Material, MovimientoStock, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type MaterialConCategoria = Material & { categoria: CategoriaMaterial };
export type MaterialConHistorial = MaterialConCategoria & { movimientos: MovimientoStock[] };

@Injectable()
export class MaterialesRepository {
  constructor(private readonly prisma: PrismaService) {}

  crear(data: Prisma.MaterialCreateInput): Promise<MaterialConCategoria> {
    return this.prisma.material.create({ data, include: { categoria: true } });
  }

  buscarTodos(
    skip: number,
    take: number,
    where: Prisma.MaterialWhereInput = {},
  ): Promise<MaterialConCategoria[]> {
    return this.prisma.material.findMany({
      where,
      skip,
      take,
      include: { categoria: true },
      orderBy: { nombre: 'asc' },
    });
  }

  contar(where: Prisma.MaterialWhereInput = {}): Promise<number> {
    return this.prisma.material.count({ where });
  }

  buscarPorId(id: string): Promise<MaterialConCategoria | null> {
    return this.prisma.material.findUnique({ where: { id }, include: { categoria: true } });
  }

  /** Material con su historial completo de movimientos (más recientes primero). */
  buscarConHistorial(id: string): Promise<MaterialConHistorial | null> {
    return this.prisma.material.findUnique({
      where: { id },
      include: {
        categoria: true,
        movimientos: { orderBy: { fecha: 'desc' } },
      },
    });
  }

  /**
   * Materiales cuyo stockActual <= stockMinimo.
   * Se compara columna contra columna con SQL crudo y luego se hidratan con Prisma.
   */
  async buscarBajoStock(): Promise<MaterialConCategoria[]> {
    const ids = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM materiales WHERE "stockActual" <= "stockMinimo"
    `;
    if (ids.length === 0) return [];
    return this.prisma.material.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
      include: { categoria: true },
      orderBy: { nombre: 'asc' },
    });
  }

  actualizar(id: string, data: Prisma.MaterialUpdateInput): Promise<MaterialConCategoria> {
    return this.prisma.material.update({ where: { id }, data, include: { categoria: true } });
  }

  eliminar(id: string): Promise<Material> {
    return this.prisma.material.delete({ where: { id } });
  }

  contarMovimientos(id: string): Promise<number> {
    return this.prisma.movimientoStock.count({ where: { materialId: id } });
  }
}
