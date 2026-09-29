import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ConsultaResponsables } from '../puertos/consulta-responsables';

/**
 * La capa anticorrupción contra el catálogo de responsables.
 *
 * Lee la tabla directo en vez de depender del servicio del otro módulo: así
 * se trae exactamente lo que hace falta —si existe— sin arrastrar su forma.
 */
@Injectable()
export class PrismaConsultaResponsables implements ConsultaResponsables {
  constructor(private readonly prisma: PrismaService) {}

  async existe(responsableId: string): Promise<boolean> {
    const fila = await this.prisma.responsable.findUnique({
      where: { id: responsableId },
      select: { id: true },
    });
    return fila !== null;
  }
}
