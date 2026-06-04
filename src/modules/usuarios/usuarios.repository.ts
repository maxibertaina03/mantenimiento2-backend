import { Injectable } from '@nestjs/common';
import { Prisma, Usuario } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class UsuariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  crear(data: Prisma.UsuarioCreateInput): Promise<Usuario> {
    return this.prisma.usuario.create({ data });
  }

  buscarTodos(skip: number, take: number): Promise<Usuario[]> {
    return this.prisma.usuario.findMany({ skip, take, orderBy: { nombre: 'asc' } });
  }

  contar(): Promise<number> {
    return this.prisma.usuario.count();
  }

  buscarPorId(id: string): Promise<Usuario | null> {
    return this.prisma.usuario.findUnique({ where: { id } });
  }

  actualizar(id: string, data: Prisma.UsuarioUpdateInput): Promise<Usuario> {
    return this.prisma.usuario.update({ where: { id }, data });
  }

  eliminar(id: string): Promise<Usuario> {
    return this.prisma.usuario.delete({ where: { id } });
  }
}
