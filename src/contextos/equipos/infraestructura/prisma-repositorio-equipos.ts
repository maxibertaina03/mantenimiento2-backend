import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Equipo } from '../dominio/equipo';
import { EstadoEquipo } from '../dominio/estado-equipo';
import {
  EquipoConRelaciones,
  FiltroEquipos,
  PaginaEquipos,
  RepositorioEquipos,
} from '../puertos/repositorio-equipos';

/** Lo que trae Prisma, antes de convertirlo a la forma del dominio. */
type FilaEquipo = Prisma.EquipoGetPayload<{
  include: {
    ubicacion: { select: { nombre: true } };
    tipo: { select: { nombre: true } };
    proveedor: { select: { nombre: true } };
  };
}>;

/**
 * Adaptador de Prisma para el repositorio de equipos.
 *
 * Es el único archivo del contexto que sabe que existe Prisma. Traduce entre la
 * fila de la base y la forma del dominio: el estado viaja como texto en la base
 * y como unión de literales adentro, y las horas de uso son Decimal en Postgres
 * y number en el dominio.
 */
@Injectable()
export class PrismaRepositorioEquipos implements RepositorioEquipos {
  constructor(private readonly prisma: PrismaService) {}

  private readonly relaciones = {
    ubicacion: { select: { nombre: true } },
    tipo: { select: { nombre: true } },
    proveedor: { select: { nombre: true } },
  } as const;

  private aDominio(fila: FilaEquipo): EquipoConRelaciones {
    return {
      id: fila.id,
      codigoInterno: fila.codigoInterno,
      nombre: fila.nombre,
      descripcion: fila.descripcion,
      marca: fila.marca,
      modelo: fila.modelo,
      numeroSerie: fila.numeroSerie,
      ubicacionId: fila.ubicacionId,
      tipoId: fila.tipoId,
      estado: fila.estado as EstadoEquipo,
      fotoUrl: fila.fotoUrl,
      proveedorId: fila.proveedorId,
      horasUso: fila.horasUso === null ? null : Number(fila.horasUso),
      fechaAlta: fila.fechaAlta,
      garantiaHasta: fila.garantiaHasta,
      ubicacionNombre: fila.ubicacion?.nombre ?? null,
      tipoNombre: fila.tipo?.nombre ?? null,
      proveedorNombre: fila.proveedor?.nombre ?? null,
    };
  }

  async crear(equipo: Omit<Equipo, 'id'>): Promise<EquipoConRelaciones> {
    const fila = await this.prisma.equipo.create({
      data: equipo,
      include: this.relaciones,
    });
    return this.aDominio(fila);
  }

  async actualizar(id: string, cambios: Partial<Omit<Equipo, 'id'>>): Promise<EquipoConRelaciones> {
    const fila = await this.prisma.equipo.update({
      where: { id },
      data: cambios,
      include: this.relaciones,
    });
    return this.aDominio(fila);
  }

  async buscarPorId(id: string): Promise<EquipoConRelaciones | null> {
    const fila = await this.prisma.equipo.findUnique({ where: { id }, include: this.relaciones });
    return fila === null ? null : this.aDominio(fila);
  }

  async buscarPorCodigoInterno(codigo: string): Promise<Equipo | null> {
    const fila = await this.prisma.equipo.findUnique({
      where: { codigoInterno: codigo },
      include: this.relaciones,
    });
    return fila === null ? null : this.aDominio(fila);
  }

  async buscarPorNombreYUbicacion(nombre: string, ubicacionId: string): Promise<Equipo | null> {
    const fila = await this.prisma.equipo.findFirst({
      // insensitive a propósito: "Bomba caldera 1" y "BOMBA CALDERA 1" son el
      // mismo equipo, y sin esto reimportar crearía el segundo.
      where: { nombre: { equals: nombre, mode: 'insensitive' }, ubicacionId },
      include: this.relaciones,
    });
    return fila === null ? null : this.aDominio(fila);
  }

  async listarNombresPorUbicaciones(
    ubicacionIds: string[],
  ): Promise<{ nombre: string; ubicacionId: string }[]> {
    if (ubicacionIds.length === 0) return [];
    const filas = await this.prisma.equipo.findMany({
      where: { ubicacionId: { in: ubicacionIds } },
      select: { nombre: true, ubicacionId: true },
    });
    // ubicacionId no puede ser null acá: vienen filtradas por la lista.
    return filas.map((f) => ({ nombre: f.nombre, ubicacionId: f.ubicacionId as string }));
  }

  async crearVarios(equipos: Omit<Equipo, 'id'>[]): Promise<number> {
    const { count } = await this.prisma.equipo.createMany({ data: equipos });
    return count;
  }

  /**
   * El nombre queda como desempate en todos los órdenes: con equipos empatados
   * —varios de la misma ubicación, o todos de criticidad media— sin un criterio
   * estable las páginas 1 y 2 pueden repetir o saltear filas.
   */
  private armarOrden(filtro: FiltroEquipos): Prisma.EquipoOrderByWithRelationInput[] {
    const dir = filtro.direccion ?? 'asc';
    switch (filtro.ordenarPor) {
      case 'codigo':
        return [{ codigoInterno: dir }, { nombre: 'asc' }];
      case 'ubicacion':
        return [{ ubicacion: { nombre: dir } }, { nombre: 'asc' }];
      default:
        return [{ nombre: dir }];
    }
  }

  async listar(filtro: FiltroEquipos): Promise<PaginaEquipos> {
    const where: Prisma.EquipoWhereInput = {};

    if (filtro.buscar) {
      // Busca por nombre o por código: quien tiene el equipo adelante lee el
      // código de la chapita, no el nombre que le pusimos en el sistema.
      where.OR = [
        { nombre: { contains: filtro.buscar, mode: 'insensitive' } },
        { codigoInterno: { contains: filtro.buscar, mode: 'insensitive' } },
      ];
    }
    if (filtro.ubicacionId) where.ubicacionId = filtro.ubicacionId;
    if (filtro.tipoId) where.tipoId = filtro.tipoId;
    if (filtro.estado) where.estado = filtro.estado;
    if (filtro.garantiaVencidaAl) where.garantiaHasta = { lt: filtro.garantiaVencidaAl };

    const [filas, total] = await Promise.all([
      this.prisma.equipo.findMany({
        where,
        skip: filtro.skip,
        take: filtro.take,
        include: this.relaciones,
        orderBy: this.armarOrden(filtro),
      }),
      this.prisma.equipo.count({ where }),
    ]);

    return { datos: filas.map((f) => this.aDominio(f)), total };
  }

  async eliminar(id: string): Promise<void> {
    await this.prisma.equipo.delete({ where: { id } });
  }
}
