import { Injectable } from '@nestjs/common';
import { Prisma, Proveedor } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Único punto de acceso a datos de Proveedor. El service nunca toca Prisma directo.
 */
@Injectable()
export class ProveedoresRepository {
  constructor(private readonly prisma: PrismaService) {}

  crear(data: Prisma.ProveedorCreateInput): Promise<Proveedor> {
    return this.prisma.proveedor.create({ data });
  }

  buscarTodos(
    skip: number,
    take: number,
    where: Prisma.ProveedorWhereInput = {},
  ): Promise<Proveedor[]> {
    return this.prisma.proveedor.findMany({
      where,
      skip,
      take,
      orderBy: { nombre: 'asc' },
    });
  }

  contar(where: Prisma.ProveedorWhereInput = {}): Promise<number> {
    return this.prisma.proveedor.count({ where });
  }

  buscarPorId(id: string): Promise<Proveedor | null> {
    return this.prisma.proveedor.findUnique({ where: { id } });
  }

  actualizar(id: string, data: Prisma.ProveedorUpdateInput): Promise<Proveedor> {
    return this.prisma.proveedor.update({ where: { id }, data });
  }

  eliminar(id: string): Promise<Proveedor> {
    return this.prisma.proveedor.delete({ where: { id } });
  }
}
