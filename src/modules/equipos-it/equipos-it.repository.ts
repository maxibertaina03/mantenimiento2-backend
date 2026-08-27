import { Injectable } from '@nestjs/common';
import { EstadoEquipoIT, Prisma, TipoEquipoIT } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AsignacionConRelaciones, EquipoConRelaciones } from './dto/equipo-respuesta.dto';

/** Filtro del listado, en lenguaje de dominio (sin tipos de Prisma). */
export interface FiltroEquipos {
  buscar?: string;
  tipo?: TipoEquipoIT;
  estado?: EstadoEquipoIT;
  asignadoAId?: string;
}

export interface DatosAsignacion {
  equipoId: string;
  usuarioId: string | null;
  registradoPorId: string | null;
  motivo?: string | null;
  notas?: string | null;
  /** Estado en el que queda el equipo tras el movimiento. */
  estadoResultante: EstadoEquipoIT;
}

@Injectable()
export class EquiposItRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly relaciones = {
    proveedor: { select: { nombre: true } },
    asignadoA: { select: { nombre: true } },
  };

  /** Traduce el filtro de dominio al `where` de Prisma. */
  private aWhere(filtro: FiltroEquipos): Prisma.EquipoITWhereInput {
    const texto = filtro.buscar?.trim();
    return {
      ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
      ...(filtro.estado ? { estado: filtro.estado } : {}),
      ...(filtro.asignadoAId ? { asignadoAId: filtro.asignadoAId } : {}),
      // Busca en todos los campos por los que alguien buscaría un equipo.
      ...(texto
        ? {
            OR: [
              { codigoInterno: { contains: texto, mode: 'insensitive' as const } },
              { marca: { contains: texto, mode: 'insensitive' as const } },
              { modelo: { contains: texto, mode: 'insensitive' as const } },
              { numeroSerie: { contains: texto, mode: 'insensitive' as const } },
              { direccionIp: { contains: texto, mode: 'insensitive' as const } },
              { nombreEnRed: { contains: texto, mode: 'insensitive' as const } },
              { ubicacion: { contains: texto, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  crear(data: Prisma.EquipoITCreateInput): Promise<EquipoConRelaciones> {
    return this.prisma.equipoIT.create({ data, include: this.relaciones });
  }

  buscarConFiltros(
    filtro: FiltroEquipos,
    skip: number,
    take: number,
  ): Promise<EquipoConRelaciones[]> {
    return this.prisma.equipoIT.findMany({
      where: this.aWhere(filtro),
      skip,
      take,
      orderBy: [{ tipo: 'asc' }, { marca: 'asc' }, { modelo: 'asc' }],
      include: this.relaciones,
    });
  }

  contar(filtro: FiltroEquipos): Promise<number> {
    return this.prisma.equipoIT.count({ where: this.aWhere(filtro) });
  }

  buscarPorId(id: string): Promise<EquipoConRelaciones | null> {
    return this.prisma.equipoIT.findUnique({ where: { id }, include: this.relaciones });
  }

  buscarPorCodigoInterno(codigoInterno: string): Promise<EquipoConRelaciones | null> {
    return this.prisma.equipoIT.findUnique({
      where: { codigoInterno },
      include: this.relaciones,
    });
  }

  actualizar(id: string, data: Prisma.EquipoITUpdateInput): Promise<EquipoConRelaciones> {
    return this.prisma.equipoIT.update({ where: { id }, data, include: this.relaciones });
  }

  eliminar(id: string): Promise<unknown> {
    return this.prisma.equipoIT.delete({ where: { id } });
  }

  /**
   * Registra un cambio de asignación: cierra el tramo vigente y abre uno nuevo,
   * y deja el equipo apuntando a su tenedor actual. Todo en una transacción
   * para que no queden dos tramos abiertos a la vez.
   */
  async reasignar(datos: DatosAsignacion): Promise<EquipoConRelaciones> {
    return this.prisma.$transaction(async (tx) => {
      // Cierra el tramo abierto (si lo hay).
      await tx.asignacionEquipoIT.updateMany({
        where: { equipoId: datos.equipoId, hasta: null },
        data: { hasta: new Date() },
      });

      await tx.asignacionEquipoIT.create({
        data: {
          equipoId: datos.equipoId,
          usuarioId: datos.usuarioId,
          registradoPorId: datos.registradoPorId,
          motivo: datos.motivo ?? null,
          notas: datos.notas ?? null,
        },
      });

      return tx.equipoIT.update({
        where: { id: datos.equipoId },
        data: { asignadoAId: datos.usuarioId, estado: datos.estadoResultante },
        include: this.relaciones,
      });
    });
  }

  listarAsignaciones(equipoId: string): Promise<AsignacionConRelaciones[]> {
    return this.prisma.asignacionEquipoIT.findMany({
      where: { equipoId },
      orderBy: { desde: 'desc' },
      include: {
        usuario: { select: { nombre: true } },
        registradoPor: { select: { nombre: true } },
      },
    });
  }

  /** Conteo por tipo y por estado, para el panel del módulo. */
  async resumen(): Promise<{
    porTipo: { tipo: TipoEquipoIT; cantidad: number }[];
    porEstado: { estado: EstadoEquipoIT; cantidad: number }[];
    total: number;
  }> {
    const [porTipo, porEstado, total] = await Promise.all([
      this.prisma.equipoIT.groupBy({ by: ['tipo'], _count: { _all: true } }),
      this.prisma.equipoIT.groupBy({ by: ['estado'], _count: { _all: true } }),
      this.prisma.equipoIT.count(),
    ]);
    return {
      porTipo: porTipo.map((t) => ({ tipo: t.tipo, cantidad: t._count._all })),
      porEstado: porEstado.map((e) => ({ estado: e.estado, cantidad: e._count._all })),
      total,
    };
  }
}
