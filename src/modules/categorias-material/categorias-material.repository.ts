import { Injectable } from '@nestjs/common';
import { CategoriaMaterial, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CategoriasMaterialRepository {
  constructor(private readonly prisma: PrismaService) {}

  crear(data: Prisma.CategoriaMaterialCreateInput): Promise<CategoriaMaterial> {
    return this.prisma.categoriaMaterial.create({ data });
  }

  buscarTodas(): Promise<CategoriaMaterial[]> {
    return this.prisma.categoriaMaterial.findMany({ orderBy: { nombre: 'asc' } });
  }

  buscarPorId(id: string): Promise<CategoriaMaterial | null> {
    return this.prisma.categoriaMaterial.findUnique({ where: { id } });
  }

  actualizar(id: string, data: Prisma.CategoriaMaterialUpdateInput): Promise<CategoriaMaterial> {
    return this.prisma.categoriaMaterial.update({ where: { id }, data });
  }

  eliminar(id: string): Promise<CategoriaMaterial> {
    return this.prisma.categoriaMaterial.delete({ where: { id } });
  }

  /** Cuántos materiales usan esta categoría (para impedir borrado con dependencias). */
  contarMateriales(id: string): Promise<number> {
    return this.prisma.material.count({ where: { categoriaId: id } });
  }
}
