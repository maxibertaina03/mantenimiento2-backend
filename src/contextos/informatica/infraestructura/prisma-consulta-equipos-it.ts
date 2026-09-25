import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ConsultaEquiposIt } from '../puertos/consulta-equipos-it';

/**
 * La capa anticorrupción contra el inventario de informática.
 *
 * Lee la tabla directo en vez de pedirle el repositorio al otro módulo: así se
 * trae exactamente lo que el baúl necesita —si existe, nada más— sin arrastrar
 * el modelo entero del equipo.
 */
@Injectable()
export class PrismaConsultaEquiposIt implements ConsultaEquiposIt {
  constructor(private readonly prisma: PrismaService) {}

  async existe(equipoItId: string): Promise<boolean> {
    const fila = await this.prisma.equipoIT.findUnique({
      where: { id: equipoItId },
      select: { id: true },
    });
    return fila !== null;
  }
}
