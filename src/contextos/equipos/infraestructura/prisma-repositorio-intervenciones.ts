import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Ejecutor, Intervencion, TipoIntervencion } from '../dominio/intervencion';
import {
  IntervencionConRelaciones,
  RepositorioIntervenciones,
} from '../puertos/repositorio-intervenciones';

type Fila = Prisma.IntervencionGetPayload<{
  include: {
    usuario: { select: { nombre: true } };
    proveedor: { select: { nombre: true } };
    registradoPor: { select: { nombre: true } };
  };
}>;

/** El único archivo del historial que sabe que existe Prisma. */
@Injectable()
export class PrismaRepositorioIntervenciones implements RepositorioIntervenciones {
  constructor(private readonly prisma: PrismaService) {}

  private readonly relaciones = {
    usuario: { select: { nombre: true } },
    proveedor: { select: { nombre: true } },
    registradoPor: { select: { nombre: true } },
  } as const;

  private aDominio(fila: Fila): IntervencionConRelaciones {
    return {
      id: fila.id,
      equipoId: fila.equipoId,
      planId: fila.planId,
      tipo: fila.tipo as TipoIntervencion,
      fecha: fila.fecha,
      ejecutor: fila.ejecutor as Ejecutor,
      usuarioId: fila.usuarioId,
      proveedorId: fila.proveedorId,
      descripcion: fila.descripcion,
      // Decimal en Postgres, number en el dominio.
      costoManoObra: fila.costoManoObra === null ? null : Number(fila.costoManoObra),
      horasParada: fila.horasParada === null ? null : Number(fila.horasParada),
      documentoUrl: fila.documentoUrl,
      registradoPorId: fila.registradoPorId,
      creadoEn: fila.creadoEn,
      usuarioNombre: fila.usuario?.nombre ?? null,
      proveedorNombre: fila.proveedor?.nombre ?? null,
      registradoPorNombre: fila.registradoPor?.nombre ?? null,
    };
  }

  async crear(
    intervencion: Omit<Intervencion, 'id' | 'creadoEn'>,
  ): Promise<IntervencionConRelaciones> {
    const fila = await this.prisma.intervencion.create({
      data: intervencion,
      include: this.relaciones,
    });
    return this.aDominio(fila);
  }

  async listarPorEquipo(equipoId: string): Promise<IntervencionConRelaciones[]> {
    const filas = await this.prisma.intervencion.findMany({
      where: { equipoId },
      include: this.relaciones,
      // creadoEn desempata: dos trabajos del mismo día tienen que salir en un
      // orden estable, o la lista baila entre recargas.
      orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
    });
    return filas.map((f) => this.aDominio(f));
  }

  async buscarPorId(id: string): Promise<IntervencionConRelaciones | null> {
    const fila = await this.prisma.intervencion.findUnique({
      where: { id },
      include: this.relaciones,
    });
    return fila === null ? null : this.aDominio(fila);
  }
}
