import { Injectable, NotFoundException } from '@nestjs/common';
import { EstadoOrdenCompra, MotivoMovimiento, Prisma, TipoMovimiento } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Decimal, aDecimal } from '../../common/dominio/decimal';
import { OrdenConRelaciones } from './dto/orden-respuesta.dto';

export interface FiltroOrdenes {
  buscar?: string;
  estado?: EstadoOrdenCompra;
  proveedorId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
}

export interface DatosRenglon {
  materialId: string;
  cantidad: Decimal;
  precioUnitario?: Decimal | null;
  notas?: string | null;
}

export interface DatosCrearOrden {
  proveedorId: string;
  fechaEntregaEstimada?: Date | null;
  observaciones?: string | null;
  creadoPorId?: string | null;
  renglones: DatosRenglon[];
}

@Injectable()
export class OrdenesCompraRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly relaciones = {
    proveedor: { select: { nombre: true, cuit: true } },
    creadoPor: { select: { nombre: true } },
    recibidaPor: { select: { nombre: true } },
    renglones: {
      include: { material: { select: { nombre: true, unidad: true } } },
      orderBy: { id: 'asc' as const },
    },
  };

  private aWhere(filtro: FiltroOrdenes): Prisma.OrdenCompraWhereInput {
    const texto = filtro.buscar?.trim();
    return {
      ...(filtro.estado ? { estado: filtro.estado } : {}),
      ...(filtro.proveedorId ? { proveedorId: filtro.proveedorId } : {}),
      ...(filtro.fechaDesde || filtro.fechaHasta
        ? {
            fecha: {
              ...(filtro.fechaDesde ? { gte: filtro.fechaDesde } : {}),
              ...(filtro.fechaHasta ? { lte: filtro.fechaHasta } : {}),
            },
          }
        : {}),
      ...(texto
        ? {
            OR: [
              { numero: { contains: texto, mode: 'insensitive' as const } },
              { proveedor: { nombre: { contains: texto, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
  }

  /**
   * Reserva el siguiente número correlativo de una serie (ej. "OC-2026").
   *
   * El INSERT ... ON CONFLICT DO UPDATE es una sola sentencia atómica: dos
   * usuarios creando órdenes al mismo tiempo obtienen números distintos, sin la
   * race de "leer el máximo y sumarle uno".
   */
  private async siguienteNumero(tx: Prisma.TransactionClient, serie: string): Promise<number> {
    const filas = await tx.$queryRaw<{ ultimo: number }[]>`
      INSERT INTO contadores_documento (clave, ultimo) VALUES (${serie}, 1)
      ON CONFLICT (clave) DO UPDATE SET ultimo = contadores_documento.ultimo + 1
      RETURNING ultimo
    `;
    return filas[0].ultimo;
  }

  /** Crea la orden con sus renglones y le asigna el número correlativo. */
  async crear(datos: DatosCrearOrden): Promise<OrdenConRelaciones> {
    return this.prisma.$transaction(async (tx) => {
      const anio = new Date().getFullYear();
      const serie = `OC-${anio}`;
      const correlativo = await this.siguienteNumero(tx, serie);
      const numero = `${serie}-${String(correlativo).padStart(4, '0')}`;

      return tx.ordenCompra.create({
        data: {
          numero,
          proveedorId: datos.proveedorId,
          fechaEntregaEstimada: datos.fechaEntregaEstimada,
          observaciones: datos.observaciones,
          creadoPorId: datos.creadoPorId,
          renglones: {
            create: datos.renglones.map((r) => ({
              materialId: r.materialId,
              cantidad: aDecimal(r.cantidad),
              precioUnitario:
                r.precioUnitario === null || r.precioUnitario === undefined
                  ? null
                  : new Prisma.Decimal(r.precioUnitario.toFixed(2)),
              notas: r.notas ?? null,
            })),
          },
        },
        include: this.relaciones,
      });
    });
  }

  buscarConFiltros(
    filtro: FiltroOrdenes,
    skip: number,
    take: number,
  ): Promise<OrdenConRelaciones[]> {
    return this.prisma.ordenCompra.findMany({
      where: this.aWhere(filtro),
      skip,
      take,
      orderBy: { fecha: 'desc' },
      include: this.relaciones,
    });
  }

  contar(filtro: FiltroOrdenes): Promise<number> {
    return this.prisma.ordenCompra.count({ where: this.aWhere(filtro) });
  }

  buscarPorId(id: string): Promise<OrdenConRelaciones | null> {
    return this.prisma.ordenCompra.findUnique({ where: { id }, include: this.relaciones });
  }

  /** Reemplaza los renglones y los datos de cabecera (solo en BORRADOR). */
  async actualizar(id: string, datos: Partial<DatosCrearOrden>): Promise<OrdenConRelaciones> {
    return this.prisma.$transaction(async (tx) => {
      if (datos.renglones) {
        // Se reemplaza el detalle completo: es más simple y predecible que
        // diferenciar altas/bajas/modificaciones renglón por renglón.
        await tx.renglonOrdenCompra.deleteMany({ where: { ordenId: id } });
        await tx.renglonOrdenCompra.createMany({
          data: datos.renglones.map((r) => ({
            ordenId: id,
            materialId: r.materialId,
            cantidad: aDecimal(r.cantidad),
            precioUnitario:
              r.precioUnitario === null || r.precioUnitario === undefined
                ? null
                : new Prisma.Decimal(r.precioUnitario.toFixed(2)),
            notas: r.notas ?? null,
          })),
        });
      }

      return tx.ordenCompra.update({
        where: { id },
        data: {
          proveedorId: datos.proveedorId,
          fechaEntregaEstimada: datos.fechaEntregaEstimada,
          observaciones: datos.observaciones,
        },
        include: this.relaciones,
      });
    });
  }

  cambiarEstado(
    id: string,
    estado: EstadoOrdenCompra,
    extra: Prisma.OrdenCompraUpdateInput = {},
  ): Promise<OrdenConRelaciones> {
    return this.prisma.ordenCompra.update({
      where: { id },
      data: { estado, ...extra },
      include: this.relaciones,
    });
  }

  /**
   * Recibe la orden: por cada renglón crea un movimiento de ENTRADA y suma el
   * stock del material, todo en UNA transacción.
   *
   * Se toma lock de cada material (SELECT ... FOR UPDATE) igual que en el alta
   * manual de movimientos, para no perder actualizaciones si alguien está
   * cargando stock del mismo material al mismo tiempo.
   */
  async recibir(params: {
    id: string;
    fechaRecepcion: Date;
    recibidaPorId: string | null;
    referencia: string;
    notas?: string | null;
  }): Promise<OrdenConRelaciones> {
    const { id, fechaRecepcion, recibidaPorId, referencia, notas } = params;

    return this.prisma.$transaction(async (tx) => {
      const orden = await tx.ordenCompra.findUnique({
        where: { id },
        include: { renglones: true },
      });
      if (!orden) {
        throw new NotFoundException(`No existe la orden de compra con id ${id}`);
      }

      for (const renglon of orden.renglones) {
        // Lock de la fila del material antes de leer su stock.
        const filas = await tx.$queryRaw<{ stockActual: Prisma.Decimal }[]>`
          SELECT "stockActual" FROM materiales WHERE id = ${renglon.materialId}::uuid FOR UPDATE
        `;
        if (filas.length === 0) {
          throw new NotFoundException(`No existe el material con id ${renglon.materialId}`);
        }

        const cantidad = aDecimal(renglon.cantidad);
        const nuevoStock = aDecimal(filas[0].stockActual).plus(cantidad);

        const movimiento = await tx.movimientoStock.create({
          data: {
            materialId: renglon.materialId,
            tipo: TipoMovimiento.ENTRADA,
            motivo: MotivoMovimiento.COMPRA,
            cantidad,
            fecha: fechaRecepcion,
            proveedorId: orden.proveedorId,
            usuarioId: recibidaPorId,
            // Trazabilidad: desde el historial de stock se llega a la orden.
            referenciaTrabajo: referencia,
            notas: notas ?? null,
          },
        });

        await tx.material.update({
          where: { id: renglon.materialId },
          data: { stockActual: nuevoStock },
        });

        // Enlace renglón ↔ movimiento generado.
        await tx.renglonOrdenCompra.update({
          where: { id: renglon.id },
          data: { movimientoId: movimiento.id },
        });
      }

      return tx.ordenCompra.update({
        where: { id },
        data: {
          estado: EstadoOrdenCompra.RECIBIDA,
          recibidaEn: fechaRecepcion,
          recibidaPorId,
        },
        include: this.relaciones,
      });
    });
  }

  eliminar(id: string): Promise<unknown> {
    return this.prisma.ordenCompra.delete({ where: { id } });
  }
}
