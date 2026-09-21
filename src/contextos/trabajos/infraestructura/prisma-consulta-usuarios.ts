import { Injectable } from '@nestjs/common';
import { PERMISOS } from '../../../common/auth/permisos';
import { PermisosService } from '../../../common/auth/permisos.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ConsultaUsuarios, UsuarioAsignable } from '../puertos/consulta-usuarios';

/**
 * Quién puede hacerse cargo de un trabajo.
 *
 * "Puede" se resuelve mirando los permisos del rol, no el rol en sí. Es la
 * diferencia entre una regla que sigue siendo cierta cuando alguien cambia los
 * permisos desde la pantalla, y una lista de roles escrita a mano que queda
 * mintiendo el día que eso pase.
 */
@Injectable()
export class PrismaConsultaUsuarios implements ConsultaUsuarios {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permisos: PermisosService,
  ) {}

  private async puedeTrabajar(rol: string): Promise<boolean> {
    const suyos = await this.permisos.permisosDe(rol as never);
    return suyos.has(PERMISOS.TRABAJOS_EDITAR);
  }

  async buscarPorId(id: string): Promise<UsuarioAsignable | null> {
    const fila = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, nombre: true, rol: true },
    });
    if (!fila) return null;

    return {
      id: fila.id,
      nombre: fila.nombre,
      puedeTrabajar: await this.puedeTrabajar(fila.rol),
    };
  }

  async listarAsignables(): Promise<UsuarioAsignable[]> {
    const filas = await this.prisma.usuario.findMany({
      select: { id: true, nombre: true, rol: true },
      orderBy: { nombre: 'asc' },
    });

    const asignables: UsuarioAsignable[] = [];
    for (const fila of filas) {
      // Los que no pueden trabajar órdenes ni aparecen: ofrecerlos y después
      // rechazarlos sería hacer elegir una opción que nunca iba a andar.
      if (!(await this.puedeTrabajar(fila.rol))) continue;
      asignables.push({ id: fila.id, nombre: fila.nombre, puedeTrabajar: true });
    }
    return asignables;
  }
}
