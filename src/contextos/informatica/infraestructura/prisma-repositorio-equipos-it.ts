import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { claveDeOrden } from '../dominio/clave-orden';
import { EstadoEquipoIt, TipoAccesoRemoto, TipoDisco } from '../dominio/equipo-it';
import {
  AsignacionIt,
  DatosAsignacion,
  DatosEquipoIt,
  EquipoItConRelaciones,
  FiltroEquiposIt,
  RepositorioEquiposIt,
  ResumenEquiposIt,
} from '../puertos/repositorio-equipos-it';

const RELACIONES = {
  tipo: { select: { nombre: true, llevaEspecificaciones: true } },
  proveedor: { select: { nombre: true } },
  marca: { select: { nombre: true } },
  modelo: { select: { nombre: true } },
  ubicacion: { select: { nombre: true } },
  responsable: { select: { nombre: true, activo: true } },
} satisfies Prisma.EquipoITInclude;

type Fila = Prisma.EquipoITGetPayload<{ include: typeof RELACIONES }>;

/** El único archivo de los equipos de informática que sabe que existe Prisma. */
@Injectable()
export class PrismaRepositorioEquiposIt implements RepositorioEquiposIt {
  constructor(private readonly prisma: PrismaService) {}

  private aDominio(e: Fila): EquipoItConRelaciones {
    return {
      id: e.id,
      codigoInterno: e.codigoInterno,
      tipoId: e.tipoId,
      tipoNombre: e.tipo?.nombre ?? null,
      // Sin tipo cargado se piden igual: es peor perder el dato que pedir de más.
      llevaEspecificaciones: e.tipo?.llevaEspecificaciones ?? true,
      estado: e.estado as EstadoEquipoIt,
      qrGeneradoEn: e.qrGeneradoEn,
      marcaId: e.marcaId,
      marcaNombre: e.marca?.nombre ?? null,
      modeloId: e.modeloId,
      modeloNombre: e.modelo?.nombre ?? null,
      numeroSerie: e.numeroSerie,
      procesador: e.procesador,
      memoriaRamGb: e.memoriaRamGb,
      discoTipo: e.discoTipo as TipoDisco | null,
      discoCapacidadGb: e.discoCapacidadGb,
      sistemaOperativo: e.sistemaOperativo,
      direccionIp: e.direccionIp,
      direccionMac: e.direccionMac,
      nombreEnRed: e.nombreEnRed,
      accesoRemoto: e.accesoRemoto as TipoAccesoRemoto,
      accesoRemotoId: e.accesoRemotoId,
      ubicacionId: e.ubicacionId,
      ubicacionNombre: e.ubicacion?.nombre ?? null,
      proveedorId: e.proveedorId,
      proveedorNombre: e.proveedor?.nombre ?? null,
      fechaCompra: e.fechaCompra,
      garantiaHasta: e.garantiaHasta,
      notas: e.notas,
      responsableId: e.responsableId,
      responsableNombre: e.responsable?.nombre ?? null,
      creadoEn: e.creadoEn,
    };
  }

  /** Traduce el filtro del contexto al `where` de Prisma. */
  private aWhere(filtro: FiltroEquiposIt): Prisma.EquipoITWhereInput {
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
      // modelo y ubicación son catálogos, así que se busca por su nombre.
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
   * Los datos del contexto, listos para Prisma.
   *
   * Un campo en `undefined` no viaja: quiere decir "no tocar". Sin esto, una
   * edición que solo cambia las notas pisaría el resto con vacío.
   */
  private aDatos(d: DatosEquipoIt): Prisma.EquipoITUncheckedUpdateInput {
    const salida: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(d)) {
      if (valor !== undefined) salida[clave] = valor;
    }
    return salida as Prisma.EquipoITUncheckedUpdateInput;
  }

  async buscarPorId(id: string): Promise<EquipoItConRelaciones | null> {
    const fila = await this.prisma.equipoIT.findUnique({ where: { id }, include: RELACIONES });
    return fila ? this.aDominio(fila) : null;
  }

  async buscarPorCodigoInterno(codigoInterno: string): Promise<EquipoItConRelaciones | null> {
    const fila = await this.prisma.equipoIT.findUnique({
      where: { codigoInterno },
      include: RELACIONES,
    });
    return fila ? this.aDominio(fila) : null;
  }

  async listar(
    filtro: FiltroEquiposIt,
    skip: number,
    take: number,
  ): Promise<EquipoItConRelaciones[]> {
    const filas = await this.prisma.equipoIT.findMany({
      where: this.aWhere(filtro),
      skip,
      take,
      // Por clave de orden: agrupa por prefijo y ordena el número de verdad
      // ("PC2" antes que "PC10"). Los equipos sin código van al final.
      orderBy: [
        { ordenClave: { sort: 'asc', nulls: 'last' } },
        { marca: { nombre: 'asc' } },
        { modelo: { nombre: 'asc' } },
      ],
      include: RELACIONES,
    });
    return filas.map((f) => this.aDominio(f));
  }

  contar(filtro: FiltroEquiposIt): Promise<number> {
    return this.prisma.equipoIT.count({ where: this.aWhere(filtro) });
  }

  /**
   * La clave de orden se calcula acá y no en el caso de uso para que ningún
   * camino de escritura pueda olvidarse de actualizarla: alta manual, edición,
   * importación masiva.
   */
  async crear(datos: DatosEquipoIt & { tipoId: string }): Promise<EquipoItConRelaciones> {
    const fila = await this.prisma.equipoIT.create({
      data: {
        ...(this.aDatos(datos) as Prisma.EquipoITUncheckedCreateInput),
        tipoId: datos.tipoId,
        ordenClave: claveDeOrden(datos.codigoInterno ?? null),
      },
      include: RELACIONES,
    });
    return this.aDominio(fila);
  }

  async actualizar(id: string, datos: DatosEquipoIt): Promise<EquipoItConRelaciones> {
    const data = this.aDatos(datos);
    // Solo se recalcula si la edición toca el código interno.
    if (datos.codigoInterno !== undefined) {
      data.ordenClave = claveDeOrden(datos.codigoInterno);
    }
    const fila = await this.prisma.equipoIT.update({ where: { id }, data, include: RELACIONES });
    return this.aDominio(fila);
  }

  async eliminar(id: string): Promise<void> {
    await this.prisma.equipoIT.delete({ where: { id } });
  }

  /**
   * Es una fecha y no un sí/no: sirve para reimprimir si cambia el formato y
   * para saber cuáles quedan sin pegar.
   */
  async marcarQrGenerado(ids: string[], cuando: Date): Promise<number> {
    const { count } = await this.prisma.equipoIT.updateMany({
      where: { id: { in: ids } },
      data: { qrGeneradoEn: cuando },
    });
    return count;
  }

  async reasignar(datos: DatosAsignacion): Promise<EquipoItConRelaciones> {
    const fila = await this.prisma.$transaction(async (tx) => {
      // Cierra el tramo abierto, si lo hay.
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
        include: RELACIONES,
      });
    });
    return this.aDominio(fila);
  }

  async listarAsignaciones(equipoId: string): Promise<AsignacionIt[]> {
    const filas = await this.prisma.asignacionEquipoIT.findMany({
      where: { equipoId },
      orderBy: { desde: 'desc' },
      include: {
        responsable: { select: { nombre: true } },
        registradoPor: { select: { nombre: true } },
      },
    });
    return filas.map((a) => ({
      id: a.id,
      responsableId: a.responsableId,
      responsableNombre: a.responsable?.nombre ?? null,
      registradoPorNombre: a.registradoPor?.nombre ?? null,
      desde: a.desde,
      hasta: a.hasta,
      motivo: a.motivo,
      notas: a.notas,
    }));
  }

  /** Conteo por tipo y por estado, para el panel del módulo. */
  async resumen(): Promise<ResumenEquiposIt> {
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
      porEstado: porEstado.map((e) => ({
        estado: e.estado as EstadoEquipoIt,
        cantidad: e._count._all,
      })),
      total,
    };
  }
}
