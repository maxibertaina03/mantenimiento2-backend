import { Injectable } from '@nestjs/common';
import { EstadoEquipoIT, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { claveDeOrden } from './clave-orden';
import { AsignacionConRelaciones, EquipoConRelaciones } from './dto/equipo-respuesta.dto';

/** Filtro del listado, en lenguaje de dominio (sin tipos de Prisma). */
export interface FiltroEquipos {
  buscar?: string;
  tipoId?: string;
  estado?: EstadoEquipoIT;
  responsableId?: string;
  marcaId?: string;
  ubicacionId?: string;
  /** `true` trae solo los que no tienen responsable asignado. */
  sinResponsable?: boolean;
  /** `true` trae solo los que todavía no tienen la etiqueta QR impresa. */
  sinQr?: boolean;
}

export interface DatosAsignacion {
  equipoId: string;
  responsableId: string | null;
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
    tipo: { select: { nombre: true, llevaEspecificaciones: true } },
    proveedor: { select: { nombre: true } },
    marca: { select: { nombre: true } },
    modelo: { select: { nombre: true } },
    ubicacion: { select: { nombre: true } },
    responsable: { select: { nombre: true, activo: true } },
  };

  /** Traduce el filtro de dominio al `where` de Prisma. */
  private aWhere(filtro: FiltroEquipos): Prisma.EquipoITWhereInput {
    const texto = filtro.buscar?.trim();
    return {
      ...(filtro.tipoId ? { tipoId: filtro.tipoId } : {}),
      ...(filtro.estado ? { estado: filtro.estado } : {}),
      ...(filtro.marcaId ? { marcaId: filtro.marcaId } : {}),
      ...(filtro.ubicacionId ? { ubicacionId: filtro.ubicacionId } : {}),
      ...(filtro.sinQr ? { qrGeneradoEn: null } : {}),
      // `sinResponsable` gana sobre `responsableId`: pedir las dos cosas es
      // contradictorio, y dejar las dos devolvería siempre vacío sin explicar
      // por qué.
      ...(filtro.sinResponsable
        ? { responsableId: null }
        : filtro.responsableId
          ? { responsableId: filtro.responsableId }
          : {}),
      // Busca en todos los campos por los que alguien buscaría un equipo. Marca,
      // modelo y ubicación ahora son catálogos, así que se busca por su nombre.
      ...(texto
        ? {
            OR: [
              { codigoInterno: { contains: texto, mode: 'insensitive' as const } },
              { numeroSerie: { contains: texto, mode: 'insensitive' as const } },
              { direccionIp: { contains: texto, mode: 'insensitive' as const } },
              { nombreEnRed: { contains: texto, mode: 'insensitive' as const } },
              { marca: { nombre: { contains: texto, mode: 'insensitive' as const } } },
              { modelo: { nombre: { contains: texto, mode: 'insensitive' as const } } },
              { ubicacion: { nombre: { contains: texto, mode: 'insensitive' as const } } },
              { responsable: { nombre: { contains: texto, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
  }

  /**
   * La clave de orden se calcula acá y no en el service para que ningun camino
   * de escritura pueda olvidarse de actualizarla (alta manual, edicion,
   * importacion masiva).
   */
  crear(data: Prisma.EquipoITUncheckedCreateInput): Promise<EquipoConRelaciones> {
    return this.prisma.equipoIT.create({
      data: { ...data, ordenClave: claveDeOrden(data.codigoInterno) },
      include: this.relaciones,
    });
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
      // Por clave de orden: agrupa por prefijo y ordena el numero de verdad
      // ("PC2" antes que "PC10"). Los equipos sin codigo van al final.
      orderBy: [
        { ordenClave: { sort: 'asc', nulls: 'last' } },
        { marca: { nombre: 'asc' } },
        { modelo: { nombre: 'asc' } },
      ],
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

  actualizar(id: string, data: Prisma.EquipoITUncheckedUpdateInput): Promise<EquipoConRelaciones> {
    // Solo se recalcula si la edicion toca el codigo interno.
    const conClave =
      data.codigoInterno !== undefined
        ? { ...data, ordenClave: claveDeOrden(data.codigoInterno as string | null) }
        : data;
    return this.prisma.equipoIT.update({
      where: { id },
      data: conClave,
      include: this.relaciones,
    });
  }

  /**
   * Deja constancia de que a estos equipos se les imprimió la etiqueta.
   *
   * Es una fecha y no un sí/no: sirve para reimprimir si cambia el formato y
   * para saber cuáles quedan sin pegar. Devuelve cuántos se marcaron.
   */
  async marcarQrGenerado(ids: string[], cuando: Date): Promise<number> {
    const { count } = await this.prisma.equipoIT.updateMany({
      where: { id: { in: ids } },
      data: { qrGeneradoEn: cuando },
    });
    return count;
  }

  eliminar(id: string): Promise<unknown> {
    return this.prisma.equipoIT.delete({ where: { id } });
  }

  /**
   * Registra un cambio de responsable: cierra el tramo vigente y abre uno nuevo,
   * y deja el equipo apuntando a quien lo tiene ahora. Todo en una transacción
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
          responsableId: datos.responsableId,
          registradoPorId: datos.registradoPorId,
          motivo: datos.motivo ?? null,
          notas: datos.notas ?? null,
        },
      });

      return tx.equipoIT.update({
        where: { id: datos.equipoId },
        data: { responsableId: datos.responsableId, estado: datos.estadoResultante },
        include: this.relaciones,
      });
    });
  }

  listarAsignaciones(equipoId: string): Promise<AsignacionConRelaciones[]> {
    return this.prisma.asignacionEquipoIT.findMany({
      where: { equipoId },
      orderBy: { desde: 'desc' },
      include: {
        responsable: { select: { nombre: true } },
        registradoPor: { select: { nombre: true } },
      },
    });
  }

  /** Conteo por tipo y por estado, para el panel del módulo. */
  async resumen(): Promise<{
    porTipo: { tipoId: string; nombre: string; cantidad: number }[];
    porEstado: { estado: EstadoEquipoIT; cantidad: number }[];
    total: number;
  }> {
    // El conteo por tipo sale del catálogo para poder devolver el nombre; se
    // incluyen solo los tipos que tienen equipos.
    const [tipos, porEstado, total] = await Promise.all([
      this.prisma.tipoEquipo.findMany({
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        include: { _count: { select: { equipos: true } } },
      }),
      this.prisma.equipoIT.groupBy({ by: ['estado'], _count: { _all: true } }),
      this.prisma.equipoIT.count(),
    ]);
    return {
      porTipo: tipos
        .filter((t) => t._count.equipos > 0)
        .map((t) => ({ tipoId: t.id, nombre: t.nombre, cantidad: t._count.equipos })),
      porEstado: porEstado.map((e) => ({ estado: e.estado, cantidad: e._count._all })),
      total,
    };
  }
}
