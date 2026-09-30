import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Manual, RepositorioManuales } from '../puertos/manuales';

const CON_QUIEN = { subidoPor: { select: { nombre: true } } } as const;

type Fila = {
  id: string;
  equipoId: string;
  nombre: string;
  ruta: string;
  tamanoBytes: number;
  subidoEn: Date;
  subidoPor: { nombre: string } | null;
};

function aManual(f: Fila): Manual {
  return {
    id: f.id,
    equipoId: f.equipoId,
    nombre: f.nombre,
    ruta: f.ruta,
    tamanoBytes: f.tamanoBytes,
    subidoEn: f.subidoEn,
    subidoPorNombre: f.subidoPor?.nombre ?? null,
  };
}

/** Adaptador Prisma del puerto `RepositorioManuales`. */
@Injectable()
export class PrismaRepositorioManuales implements RepositorioManuales {
  constructor(private readonly prisma: PrismaService) {}

  async listar(equipoId: string): Promise<Manual[]> {
    const filas = await this.prisma.manualEquipo.findMany({
      where: { equipoId },
      orderBy: { subidoEn: 'asc' },
      include: CON_QUIEN,
    });
    return filas.map(aManual);
  }

  async buscar(equipoId: string, manualId: string): Promise<Manual | null> {
    const fila = await this.prisma.manualEquipo.findFirst({
      where: { id: manualId, equipoId },
      include: CON_QUIEN,
    });
    return fila ? aManual(fila) : null;
  }

  contar(equipoId: string): Promise<number> {
    return this.prisma.manualEquipo.count({ where: { equipoId } });
  }

  async crear(datos: {
    equipoId: string;
    nombre: string;
    ruta: string;
    tamanoBytes: number;
    subidoPorId: string | null;
  }): Promise<Manual> {
    return aManual(await this.prisma.manualEquipo.create({ data: datos, include: CON_QUIEN }));
  }

  async eliminar(manualId: string): Promise<void> {
    await this.prisma.manualEquipo.delete({ where: { id: manualId } });
  }
}
