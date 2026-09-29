import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ConsultaCatalogos } from '../puertos/consulta-catalogos';

/** Adaptador Prisma del puerto `ConsultaCatalogos`. */
@Injectable()
export class PrismaConsultaCatalogos implements ConsultaCatalogos {
  constructor(private readonly prisma: PrismaService) {}

  async existeCategoria(id: string): Promise<boolean> {
    return !!(await this.prisma.categoriaMaterial.findUnique({
      where: { id },
      select: { id: true },
    }));
  }

  async existeUnidad(id: string): Promise<boolean> {
    return !!(await this.prisma.unidadMedida.findUnique({ where: { id }, select: { id: true } }));
  }
}
