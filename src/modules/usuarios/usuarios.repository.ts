import { Injectable } from '@nestjs/common';
import { Prisma, RolUsuario, Usuario } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { sonElMismoNombre } from '../../common/dominio/nombres';

@Injectable()
export class UsuariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  crear(data: Prisma.UsuarioCreateInput): Promise<Usuario> {
    return this.prisma.usuario.create({ data });
  }

  /**
   * Alta/actualizacion atomica por email (provisioning desde Clerk).
   *
   * Evita la race de "buscar y despues crear": dos requests simultaneos del mismo
   * usuario nuevo pasaban ambos por el findUnique -> null y ambos llamaban create,
   * y el segundo reventaba con violacion de unique en email (500).
   */
  upsertPorEmail(data: {
    email: string;
    nombre: string;
    idExterno: string;
    rol: RolUsuario;
  }): Promise<Usuario> {
    return this.prisma.usuario.upsert({
      where: { email: data.email },
      update: { nombre: data.nombre, idExterno: data.idExterno },
      create: data,
    });
  }

  buscarTodos(skip: number, take: number): Promise<Usuario[]> {
    return this.prisma.usuario.findMany({ skip, take, orderBy: { nombre: 'asc' } });
  }

  /**
   * Busca a una persona por su nombre. Lo usa la importación de equipos de IT
   * para reutilizar a quien ya está cargado en vez de duplicarlo.
   *
   * La comparación se hace en memoria y no en la consulta: Postgres, sin la
   * extensión `unaccent`, no ignora los acentos, así que buscar «Jose Perez»
   * no encontraba a «José Pérez» y la importación creaba una segunda persona
   * con el mismo nombre. Desde ahí, los equipos de alguien quedan repartidos
   * entre dos fichas. Son decenas de filas: traerlas todas no cuesta nada.
   */
  async buscarPorNombre(nombre: string): Promise<Usuario | null> {
    const todos = await this.prisma.usuario.findMany();
    return todos.find((u) => sonElMismoNombre(u.nombre, nombre)) ?? null;
  }

  /** Cuántos usuarios tienen ese rol. Se usa para no quedarse sin ADMIN. */
  contarPorRol(rol: RolUsuario): Promise<number> {
    return this.prisma.usuario.count({ where: { rol } });
  }

  contar(): Promise<number> {
    return this.prisma.usuario.count();
  }

  buscarPorId(id: string): Promise<Usuario | null> {
    return this.prisma.usuario.findUnique({ where: { id } });
  }

  buscarPorIdExterno(idExterno: string): Promise<Usuario | null> {
    return this.prisma.usuario.findUnique({ where: { idExterno } });
  }

  buscarPorEmail(email: string): Promise<Usuario | null> {
    return this.prisma.usuario.findUnique({ where: { email } });
  }

  actualizar(id: string, data: Prisma.UsuarioUpdateInput): Promise<Usuario> {
    return this.prisma.usuario.update({ where: { id }, data });
  }

  eliminar(id: string): Promise<Usuario> {
    return this.prisma.usuario.delete({ where: { id } });
  }
}
