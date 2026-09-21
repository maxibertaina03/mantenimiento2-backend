import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  EstadoOrdenTrabajo,
  MaterialUsado,
  OrdenTrabajo,
  TipoTrabajo,
} from '../dominio/orden-trabajo';
import {
  FiltroOrdenesTrabajo,
  MaterialUsadoConRelaciones,
  OrdenTrabajoConRelaciones,
  RepositorioOrdenesTrabajo,
} from '../puertos/repositorio-ordenes-trabajo';

const RELACIONES = {
  equipo: { select: { nombre: true, codigoInterno: true } },
  abiertaPor: { select: { nombre: true } },
  cerradaPor: { select: { nombre: true } },
  materiales: {
    orderBy: { creadoEn: 'asc' },
    include: { material: { select: { nombre: true, unidad: { select: { simbolo: true } } } } },
  },
} as const;

type Fila = Prisma.OrdenTrabajoGetPayload<{ include: typeof RELACIONES }>;
type FilaMaterial = Fila['materiales'][number];

/** El único archivo de este contexto que sabe que existe Prisma. */
@Injectable()
export class PrismaRepositorioOrdenesTrabajo implements RepositorioOrdenesTrabajo {
  constructor(private readonly prisma: PrismaService) {}

  private materialADominio(fila: FilaMaterial): MaterialUsadoConRelaciones {
    return {
      id: fila.id,
      ordenTrabajoId: fila.ordenTrabajoId,
      materialId: fila.materialId,
      // Decimal en Postgres, number en el dominio.
      cantidad: fila.cantidad.toNumber(),
      movimientoId: fila.movimientoId,
      registradoPorId: fila.registradoPorId,
      creadoEn: fila.creadoEn,
      materialNombre: fila.material.nombre,
      // Los materiales viejos pueden no tener unidad cargada todavía.
      unidad: fila.material.unidad?.simbolo ?? 'u',
    };
  }

  private aDominio(fila: Fila): OrdenTrabajoConRelaciones {
    return {
      id: fila.id,
      numero: fila.numero,
      titulo: fila.titulo,
      descripcion: fila.descripcion,
      tipo: fila.tipo as TipoTrabajo,
      estado: fila.estado as EstadoOrdenTrabajo,
      equipoId: fila.equipoId,
      abiertaEn: fila.abiertaEn,
      abiertaPorId: fila.abiertaPorId,
      resolucion: fila.resolucion,
      cerradaEn: fila.cerradaEn,
      cerradaPorId: fila.cerradaPorId,
      motivoAnulacion: fila.motivoAnulacion,
      creadoEn: fila.creadoEn,
      equipoNombre: fila.equipo?.nombre ?? null,
      equipoCodigo: fila.equipo?.codigoInterno ?? null,
      abiertaPorNombre: fila.abiertaPor?.nombre ?? null,
      cerradaPorNombre: fila.cerradaPor?.nombre ?? null,
      materiales: fila.materiales.map((m) => this.materialADominio(m)),
    };
  }

  private where(filtro: FiltroOrdenesTrabajo): Prisma.OrdenTrabajoWhereInput {
    return {
      ...(filtro.estado ? { estado: filtro.estado } : {}),
      ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
      ...(filtro.equipoId ? { equipoId: filtro.equipoId } : {}),
      ...(filtro.desde || filtro.hasta
        ? {
            abiertaEn: {
              ...(filtro.desde ? { gte: filtro.desde } : {}),
              ...(filtro.hasta ? { lte: filtro.hasta } : {}),
            },
          }
        : {}),
      ...(filtro.buscar
        ? {
            OR: [
              { numero: { contains: filtro.buscar, mode: 'insensitive' } },
              { titulo: { contains: filtro.buscar, mode: 'insensitive' } },
              { descripcion: { contains: filtro.buscar, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  /**
   * Reserva el siguiente correlativo de la serie (ej. "OT-2026").
   *
   * Es el mismo contador que usan las órdenes de compra, con otra clave. El
   * INSERT ... ON CONFLICT DO UPDATE es una sola sentencia atómica: dos
   * personas abriendo una orden al mismo tiempo obtienen números distintos, sin
   * la carrera de "leer el máximo y sumarle uno".
   */
  private async siguienteNumero(tx: Prisma.TransactionClient, serie: string): Promise<number> {
    const filas = await tx.$queryRaw<{ ultimo: number }[]>`
      INSERT INTO contadores_documento (clave, ultimo) VALUES (${serie}, 1)
      ON CONFLICT (clave) DO UPDATE SET ultimo = contadores_documento.ultimo + 1
      RETURNING ultimo
    `;
    return filas[0].ultimo;
  }

  async crear(
    orden: Omit<OrdenTrabajo, 'id' | 'numero' | 'creadoEn'>,
  ): Promise<OrdenTrabajoConRelaciones> {
    const fila = await this.prisma.$transaction(async (tx) => {
      const serie = `OT-${orden.abiertaEn.getFullYear()}`;
      const correlativo = await this.siguienteNumero(tx, serie);

      return tx.ordenTrabajo.create({
        data: {
          numero: `${serie}-${String(correlativo).padStart(4, '0')}`,
          titulo: orden.titulo,
          descripcion: orden.descripcion,
          tipo: orden.tipo,
          estado: orden.estado,
          equipoId: orden.equipoId,
          abiertaEn: orden.abiertaEn,
          abiertaPorId: orden.abiertaPorId,
        },
        include: RELACIONES,
      });
    });

    return this.aDominio(fila);
  }

  async buscarPorId(id: string): Promise<OrdenTrabajoConRelaciones | null> {
    const fila = await this.prisma.ordenTrabajo.findUnique({ where: { id }, include: RELACIONES });
    return fila ? this.aDominio(fila) : null;
  }

  async listar(
    filtro: FiltroOrdenesTrabajo,
    skip: number,
    take: number,
  ): Promise<OrdenTrabajoConRelaciones[]> {
    const filas = await this.prisma.ordenTrabajo.findMany({
      where: this.where(filtro),
      // Las abiertas primero: son las que alguien tiene que terminar de cargar.
      orderBy: [{ abiertaEn: 'desc' }],
      skip,
      take,
      include: RELACIONES,
    });
    return filas.map((f) => this.aDominio(f));
  }

  async contar(filtro: FiltroOrdenesTrabajo): Promise<number> {
    return this.prisma.ordenTrabajo.count({ where: this.where(filtro) });
  }

  async actualizar(id: string, cambios: Partial<OrdenTrabajo>): Promise<OrdenTrabajoConRelaciones> {
    const fila = await this.prisma.ordenTrabajo.update({
      where: { id },
      data: {
        ...(cambios.titulo === undefined ? {} : { titulo: cambios.titulo }),
        ...(cambios.descripcion === undefined ? {} : { descripcion: cambios.descripcion }),
        ...(cambios.tipo === undefined ? {} : { tipo: cambios.tipo }),
        ...(cambios.estado === undefined ? {} : { estado: cambios.estado }),
        ...(cambios.equipoId === undefined ? {} : { equipoId: cambios.equipoId }),
        ...(cambios.resolucion === undefined ? {} : { resolucion: cambios.resolucion }),
        ...(cambios.cerradaEn === undefined ? {} : { cerradaEn: cambios.cerradaEn }),
        ...(cambios.cerradaPorId === undefined ? {} : { cerradaPorId: cambios.cerradaPorId }),
        ...(cambios.motivoAnulacion === undefined
          ? {}
          : { motivoAnulacion: cambios.motivoAnulacion }),
      },
      include: RELACIONES,
    });
    return this.aDominio(fila);
  }

  async agregarMaterial(
    material: Omit<MaterialUsado, 'id' | 'creadoEn'>,
  ): Promise<MaterialUsadoConRelaciones> {
    const fila = await this.prisma.materialUsadoTrabajo.create({
      data: {
        ordenTrabajoId: material.ordenTrabajoId,
        materialId: material.materialId,
        cantidad: new Prisma.Decimal(material.cantidad.toFixed(3)),
        movimientoId: material.movimientoId,
        registradoPorId: material.registradoPorId,
      },
      include: { material: { select: { nombre: true, unidad: { select: { simbolo: true } } } } },
    });
    return this.materialADominio(fila);
  }

  async buscarMaterialUsado(id: string): Promise<MaterialUsado | null> {
    const fila = await this.prisma.materialUsadoTrabajo.findUnique({ where: { id } });
    if (!fila) return null;
    return {
      id: fila.id,
      ordenTrabajoId: fila.ordenTrabajoId,
      materialId: fila.materialId,
      cantidad: fila.cantidad.toNumber(),
      movimientoId: fila.movimientoId,
      registradoPorId: fila.registradoPorId,
      creadoEn: fila.creadoEn,
    };
  }

  async quitarMaterial(id: string): Promise<void> {
    // Solo se borra el renglón. El movimiento de stock queda: la salida ocurrió
    // de verdad, y la devolución se asienta aparte.
    await this.prisma.materialUsadoTrabajo.delete({ where: { id } });
  }
}
