import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { rutaDeUrlPublica } from '../dominio/foto';
import { Foto, RepositorioFotos } from '../puertos/fotos';

const CON_QUIEN = { subidoPor: { select: { nombre: true } } } as const;

type Fila = {
  id: string;
  equipoId: string;
  url: string;
  ruta: string;
  descripcion: string | null;
  subidoEn: Date;
  subidoPor: { nombre: string } | null;
};

function aFoto(f: Fila): Foto {
  return {
    id: f.id,
    equipoId: f.equipoId,
    url: f.url,
    ruta: f.ruta,
    descripcion: f.descripcion,
    subidoEn: f.subidoEn,
    subidoPorNombre: f.subidoPor?.nombre ?? null,
  };
}

/** Adaptador Prisma del puerto `RepositorioFotos`. */
@Injectable()
export class PrismaRepositorioFotos implements RepositorioFotos {
  constructor(private readonly prisma: PrismaService) {}

  async listar(equipoId: string): Promise<Foto[]> {
    const filas = await this.prisma.fotoEquipo.findMany({
      where: { equipoId },
      orderBy: { subidoEn: 'asc' },
      include: CON_QUIEN,
    });
    return filas.map(aFoto);
  }

  async buscar(equipoId: string, fotoId: string): Promise<Foto | null> {
    const fila = await this.prisma.fotoEquipo.findFirst({
      where: { id: fotoId, equipoId },
      include: CON_QUIEN,
    });
    return fila ? aFoto(fila) : null;
  }

  contar(equipoId: string): Promise<number> {
    return this.prisma.fotoEquipo.count({ where: { equipoId } });
  }

  async crear(datos: {
    equipoId: string;
    url: string;
    ruta: string;
    descripcion: string | null;
    subidoPorId: string | null;
  }): Promise<Foto> {
    return aFoto(await this.prisma.fotoEquipo.create({ data: datos, include: CON_QUIEN }));
  }

  async cambiarDescripcion(fotoId: string, descripcion: string | null): Promise<Foto> {
    return aFoto(
      await this.prisma.fotoEquipo.update({
        where: { id: fotoId },
        data: { descripcion },
        include: CON_QUIEN,
      }),
    );
  }

  async eliminar(fotoId: string): Promise<void> {
    await this.prisma.fotoEquipo.delete({ where: { id: fotoId } });
  }

  async intercambiarConPrincipal(foto: Foto, principalAnterior: string | null): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.equipo.update({ where: { id: foto.equipoId }, data: { fotoUrl: foto.url } }),
      principalAnterior
        ? // La fila queda para la que era principal. La descripción era de la
          // otra foto («Chapa»), así que no le corresponde.
          this.prisma.fotoEquipo.update({
            where: { id: foto.id },
            data: {
              url: principalAnterior,
              ruta: rutaDeUrlPublica(principalAnterior) ?? '',
              descripcion: null,
            },
          })
        : this.prisma.fotoEquipo.delete({ where: { id: foto.id } }),
    ]);
  }
}
