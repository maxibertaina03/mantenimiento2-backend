import { Injectable } from '@nestjs/common';
import { Prisma, UnidadMedida } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UnidadConUso } from './dto/unidad-medida.dto';

@Injectable()
export class UnidadesMedidaRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Incluye cuántos materiales la usan: define si se puede borrar. */
  private readonly conUso = { _count: { select: { materiales: true } } };

  buscarTodas(soloActivas = false): Promise<UnidadConUso[]> {
    return this.prisma.unidadMedida.findMany({
      where: soloActivas ? { activo: true } : {},
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: this.conUso,
    });
  }

  buscarPorId(id: string): Promise<UnidadConUso | null> {
    return this.prisma.unidadMedida.findUnique({ where: { id }, include: this.conUso });
  }

  /**
   * Busca por nombre o por símbolo, sin distinguir mayúsculas. Es la consulta
   * que evita que "lt", "Lt" y "LT" entren como tres unidades distintas: ese
   * desdoblamiento es justamente lo que el catálogo viene a resolver.
   */
  buscarPorNombreOSimbolo(valor: string): Promise<UnidadMedida | null> {
    const v = valor.trim();
    return this.prisma.unidadMedida.findFirst({
      where: {
        OR: [
          { nombre: { equals: v, mode: 'insensitive' } },
          { simbolo: { equals: v, mode: 'insensitive' } },
        ],
      },
    });
  }

  crear(data: Prisma.UnidadMedidaCreateInput): Promise<UnidadConUso> {
    return this.prisma.unidadMedida.create({ data, include: this.conUso });
  }

  actualizar(id: string, data: Prisma.UnidadMedidaUpdateInput): Promise<UnidadConUso> {
    return this.prisma.unidadMedida.update({ where: { id }, data, include: this.conUso });
  }

  eliminar(id: string): Promise<unknown> {
    return this.prisma.unidadMedida.delete({ where: { id } });
  }
}
