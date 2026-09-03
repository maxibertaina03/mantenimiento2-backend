import { Injectable } from '@nestjs/common';
import { CategoriaMaterial, Material, MovimientoStock, Prisma, UnidadMedida } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type MaterialConCategoria = Material & {
  categoria: CategoriaMaterial;
  unidad: UnidadMedida | null;
};
export type MaterialConHistorial = MaterialConCategoria & { movimientos: MovimientoStock[] };

@Injectable()
export class MaterialesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** La unidad viene del catálogo; el DTO expone su símbolo junto a la cantidad. */
  private readonly relaciones = { categoria: true, unidad: true } as const;

  crear(data: Prisma.MaterialCreateInput): Promise<MaterialConCategoria> {
    return this.prisma.material.create({ data, include: this.relaciones });
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
      include: this.relaciones,
      orderBy: { nombre: 'asc' },
    });
  }

  contar(where: Prisma.MaterialWhereInput = {}): Promise<number> {
    return this.prisma.material.count({ where });
  }

  buscarPorId(id: string): Promise<MaterialConCategoria | null> {
    return this.prisma.material.findUnique({ where: { id }, include: this.relaciones });
  }

  /** Material con su historial completo de movimientos (más recientes primero). */
  buscarConHistorial(id: string): Promise<MaterialConHistorial | null> {
    return this.prisma.material.findUnique({
      where: { id },
      include: {
        ...this.relaciones,
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
      SELECT id FROM materiales
      WHERE activo = true AND "stockMinimo" > 0 AND "stockActual" <= "stockMinimo"
    `;
    if (ids.length === 0) return [];
    return this.prisma.material.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
      include: this.relaciones,
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Ids de los materiales en (o por debajo de) su stock mínimo.
   *
   * Va en SQL crudo porque compara dos columnas entre sí, y Prisma no expresa
   * `stockActual <= stockMinimo` en un `where`. Se devuelven solo los ids para
   * poder combinar este filtro con los demás y con la paginación.
   */
  async idsBajoStock(): Promise<string[]> {
    const filas = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM materiales
      WHERE activo = true AND "stockMinimo" > 0 AND "stockActual" <= "stockMinimo"
    `;
    return filas.map((f) => f.id);
  }

  buscarTodosOrdenado(
    skip: number,
    take: number,
    where: Prisma.MaterialWhereInput,
    orderBy: Prisma.MaterialOrderByWithRelationInput[],
  ): Promise<MaterialConCategoria[]> {
    return this.prisma.material.findMany({
      where,
      skip,
      take,
      include: this.relaciones,
      orderBy,
    });
  }

  actualizar(id: string, data: Prisma.MaterialUpdateInput): Promise<MaterialConCategoria> {
    return this.prisma.material.update({ where: { id }, data, include: this.relaciones });
  }

  eliminar(id: string): Promise<Material> {
    return this.prisma.material.delete({ where: { id } });
  }

  /** Cuántos materiales todavía no tienen unidad cargada. */
  contarSinUnidad(): Promise<number> {
    return this.prisma.material.count({ where: { unidadId: null } });
  }

  /**
   * Asigna una unidad a muchos materiales de una.
   *
   * `soloSinUnidad` es el modo normal: completa los huecos sin pisar lo que
   * alguien ya corrigió a mano.
   */
  async asignarUnidadMasiva(unidadId: string, soloSinUnidad: boolean): Promise<number> {
    const { count } = await this.prisma.material.updateMany({
      where: soloSinUnidad ? { unidadId: null } : {},
      data: { unidadId },
    });
    return count;
  }

  contarMovimientos(id: string): Promise<number> {
    return this.prisma.movimientoStock.count({ where: { materialId: id } });
  }
}
