import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
   * Nombre y símbolo de todas las unidades, para detectar repetidas.
   *
   * Antes esto era una consulta con `mode: 'insensitive'`, que resuelve las
   * mayúsculas y nada más: Postgres sin la extensión `unaccent` no ignora los
   * acentos, así que la comparación se hace en memoria. Son decenas de filas.
   * Ver `common/dominio/nombres`.
   */
  listarNombresYSimbolos(): Promise<{ id: string; nombre: string; simbolo: string }[]> {
    return this.prisma.unidadMedida.findMany({
      select: { id: true, nombre: true, simbolo: true },
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
