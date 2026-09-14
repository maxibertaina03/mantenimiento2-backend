import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TipoConUso } from './dto/tipo-equipo.dto';

@Injectable()
export class TiposEquipoRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Incluye cuántos equipos lo usan: define si se puede borrar. */
  private readonly conUso = { _count: { select: { equipos: true } } };

  buscarTodos(soloActivos = false): Promise<TipoConUso[]> {
    return this.prisma.tipoEquipo.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: this.conUso,
    });
  }

  buscarPorId(id: string): Promise<TipoConUso | null> {
    return this.prisma.tipoEquipo.findUnique({ where: { id }, include: this.conUso });
  }

  /**
   * Los nombres de todos los tipos, para detectar repetidos.
   *
   * Se comparan en memoria, no en la consulta: Postgres sin la extensión
   * `unaccent` no ignora los acentos, así que buscar «Camara» nunca devolvía
   * «Cámara» y el repetido entraba igual. Ver `common/dominio/nombres`.
   */
  listarNombres(): Promise<{ id: string; nombre: string }[]> {
    return this.prisma.tipoEquipo.findMany({ select: { id: true, nombre: true } });
  }

  crear(data: Prisma.TipoEquipoCreateInput): Promise<TipoConUso> {
    return this.prisma.tipoEquipo.create({ data, include: this.conUso });
  }

  actualizar(id: string, data: Prisma.TipoEquipoUpdateInput): Promise<TipoConUso> {
    return this.prisma.tipoEquipo.update({ where: { id }, data, include: this.conUso });
  }

  eliminar(id: string): Promise<unknown> {
    return this.prisma.tipoEquipo.delete({ where: { id } });
  }
}
