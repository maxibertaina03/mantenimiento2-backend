import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  CambiosPendiente,
  NuevoPendiente,
  PendienteConNombres,
  RepositorioPendientes,
} from '../puertos/repositorio-pendientes';

const RELACIONES = {
  asignadoA: { select: { nombre: true } },
  equipo: { select: { nombre: true } },
  creadoPor: { select: { nombre: true } },
  hechaPor: { select: { nombre: true } },
  ordenTrabajo: { select: { numero: true } },
} as const;

type Fila = {
  id: string;
  texto: string;
  urgente: boolean;
  asignadoAId: string | null;
  equipoId: string | null;
  creadoPorId: string | null;
  creadoEn: Date;
  hechaEn: Date | null;
  hechaPorId: string | null;
  ordenTrabajoId: string | null;
  asignadoA: { nombre: string } | null;
  equipo: { nombre: string } | null;
  creadoPor: { nombre: string } | null;
  hechaPor: { nombre: string } | null;
  ordenTrabajo: { numero: string } | null;
};

function aPendiente(f: Fila): PendienteConNombres {
  return {
    id: f.id,
    texto: f.texto,
    urgente: f.urgente,
    asignadoAId: f.asignadoAId,
    equipoId: f.equipoId,
    creadoPorId: f.creadoPorId,
    creadoEn: f.creadoEn,
    hechaEn: f.hechaEn,
    hechaPorId: f.hechaPorId,
    ordenTrabajoId: f.ordenTrabajoId,
    asignadoANombre: f.asignadoA?.nombre ?? null,
    equipoNombre: f.equipo?.nombre ?? null,
    creadoPorNombre: f.creadoPor?.nombre ?? null,
    hechaPorNombre: f.hechaPor?.nombre ?? null,
    ordenTrabajoNumero: f.ordenTrabajo?.numero ?? null,
  };
}

/** Adaptador Prisma del anotador de pendientes. */
@Injectable()
export class PrismaRepositorioPendientes implements RepositorioPendientes {
  constructor(private readonly prisma: PrismaService) {}

  async abiertos(): Promise<PendienteConNombres[]> {
    const filas = await this.prisma.pendienteMantenimiento.findMany({
      where: { hechaEn: null },
      include: RELACIONES,
    });
    return filas.map(aPendiente);
  }

  async hechosDesde(desde: Date): Promise<PendienteConNombres[]> {
    const filas = await this.prisma.pendienteMantenimiento.findMany({
      where: { hechaEn: { gte: desde } },
      include: RELACIONES,
      orderBy: { hechaEn: 'desc' },
    });
    return filas.map(aPendiente);
  }

  async buscar(id: string): Promise<PendienteConNombres | null> {
    const f = await this.prisma.pendienteMantenimiento.findUnique({
      where: { id },
      include: RELACIONES,
    });
    return f ? aPendiente(f) : null;
  }

  async crear(datos: NuevoPendiente): Promise<PendienteConNombres> {
    return aPendiente(
      await this.prisma.pendienteMantenimiento.create({ data: datos, include: RELACIONES }),
    );
  }

  async actualizar(id: string, cambios: CambiosPendiente): Promise<PendienteConNombres> {
    return aPendiente(
      await this.prisma.pendienteMantenimiento.update({
        where: { id },
        data: cambios,
        include: RELACIONES,
      }),
    );
  }

  async borrar(id: string): Promise<void> {
    await this.prisma.pendienteMantenimiento.delete({ where: { id } });
  }

  async equipoDeLaOrden(ordenTrabajoId: string): Promise<{ equipoId: string | null } | null> {
    return this.prisma.ordenTrabajo.findUnique({
      where: { id: ordenTrabajoId },
      select: { equipoId: true },
    });
  }
}
