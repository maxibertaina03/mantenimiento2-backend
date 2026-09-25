import { Injectable, NotFoundException } from '@nestjs/common';
import {
  EstadoOrdenCompra,
  MotivoMovimiento,
  Prisma,
  TipoMovimiento,
  ViaEnvioOrden,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Decimal, aDecimal } from '../../common/dominio/decimal';
import { ClasificacionEquipo, unidadesDeEquipo } from '../../common/dominio/renglon-de-compra';
import { OrdenConRelaciones } from './dto/orden-respuesta.dto';

export interface FiltroOrdenes {
  buscar?: string;
  estado?: EstadoOrdenCompra;
  proveedorId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
}

export interface DatosRenglon {
  /** Nulo cuando el renglon es de un equipo y no de un material del paniol. */
  materialId: string | null;
  cantidad: Decimal;
  precioUnitario?: Decimal | null;
  notas?: string | null;

  /** Lo del equipo. La ficha se crea recien al recibir la mercaderia. */
  descripcionEquipo?: string | null;
  clasificacion?: ClasificacionEquipo | null;
  equipoTipoId?: string | null;
  equipoMarcaId?: string | null;
  equipoModeloId?: string | null;
}

export interface DatosCrearOrden {
  proveedorId: string;
  observaciones?: string | null;
  creadoPorId?: string | null;
  renglones: DatosRenglon[];
}

@Injectable()
export class OrdenesCompraRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly relaciones = {
    // email y teléfono: la UI ofrece enviar la orden por correo o WhatsApp.
    proveedor: { select: { nombre: true, cuit: true, email: true, telefono: true } },
    creadoPor: { select: { nombre: true } },
    recibidaPor: { select: { nombre: true } },
    renglones: {
      include: {
        material: {
          select: { nombre: true, unidad: { select: { simbolo: true } } },
        },
      },
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
              // Por el comprobante: el caso real es tener el papel en la mano y
              // querer encontrar la orden, no al revés.
              { remito: { contains: texto, mode: 'insensitive' as const } },
              { factura: { contains: texto, mode: 'insensitive' as const } },
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
              // Lo del equipo viaja con el renglon: la ficha se crea recien
              // al recibir la mercaderia.
              descripcionEquipo: r.descripcionEquipo ?? null,
              clasificacion: r.clasificacion ?? null,
              equipoTipoId: r.equipoTipoId ?? null,
              equipoMarcaId: r.equipoMarcaId ?? null,
              equipoModeloId: r.equipoModeloId ?? null,
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
          observaciones: datos.observaciones,
        },
        include: this.relaciones,
      });
    });
  }

  /**
   * Deja constancia de un envío y, si la orden estaba en BORRADOR, la emite.
   *
   * Las dos cosas juntas y en una transacción porque son la misma decisión: una
   * orden que ya salió no puede seguir editándose, o el proveedor termina con
   * un PDF que no coincide con lo que dice el sistema.
   */
  async registrarEnvio(params: {
    ordenId: string;
    via: ViaEnvioOrden;
    destinatarios: string;
    automatico: boolean;
    usuarioId: string | null;
  }): Promise<OrdenConRelaciones> {
    const { ordenId, ...envio } = params;

    return this.prisma.$transaction(async (tx) => {
      await tx.envioOrden.create({ data: { ordenId, ...envio } });

      const orden = await tx.ordenCompra.findUniqueOrThrow({ where: { id: ordenId } });
      if (orden.estado === EstadoOrdenCompra.BORRADOR) {
        await tx.ordenCompra.update({
          where: { id: ordenId },
          data: { estado: EstadoOrdenCompra.EMITIDA, emitidaEn: new Date() },
        });
      }

      return tx.ordenCompra.findUniqueOrThrow({
        where: { id: ordenId },
        include: this.relaciones,
      });
    });
  }

  listarEnvios(ordenId: string) {
    return this.prisma.envioOrden.findMany({
      where: { ordenId },
      orderBy: { enviadoEn: 'desc' },
      include: { usuario: { select: { nombre: true } } },
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

  /**
   * Da de alta las fichas de los equipos comprados en un renglon.
   *
   * Una por unidad: cinco amoladoras son cinco fichas, cada una con su numero
   * de serie y su historial. Nacen con lo que se sabe de la compra —que
   * equipo, de que marca, a que proveedor y cuando entro— y con el resto
   * vacio, para que alguien lo complete desde la ficha.
   *
   * El nombre lleva un numero cuando son varias, porque si no quedan cinco
   * equipos llamados igual y no hay forma de saber cual es cual en la lista.
   */
  private async altaDeEquipos(
    tx: Prisma.TransactionClient,
    renglon: {
      id: string;
      cantidad: Prisma.Decimal;
      descripcionEquipo: string | null;
      clasificacion: ClasificacionEquipo | null;
      equipoTipoId: string | null;
      equipoMarcaId: string | null;
      equipoModeloId: string | null;
    },
    proveedorId: string,
    fechaRecepcion: Date,
  ): Promise<void> {
    const unidades = unidadesDeEquipo({
      descripcionEquipo: renglon.descripcionEquipo,
      cantidad: Number(renglon.cantidad),
    });
    const nombre = (renglon.descripcionEquipo ?? 'Equipo comprado').trim();

    for (let i = 1; i <= unidades; i++) {
      await tx.equipo.create({
        data: {
          nombre: unidades === 1 ? nombre : `${nombre} (${i} de ${unidades})`,
          clasificacion: renglon.clasificacion ?? 'EQUIPO',
          tipoId: renglon.equipoTipoId,
          marcaId: renglon.equipoMarcaId,
          modeloId: renglon.equipoModeloId,
          proveedorId,
          fechaAlta: fechaRecepcion,
          renglonOrdenCompraId: renglon.id,
        },
      });
    }
  }

  async recibir(params: {
    id: string;
    fechaRecepcion: Date;
    recibidaPorId: string | null;
    referencia: string;
    remito: string | null;
    factura: string | null;
    notas?: string | null;
  }): Promise<OrdenConRelaciones> {
    const { id, fechaRecepcion, recibidaPorId, referencia, remito, factura, notas } = params;

    return this.prisma.$transaction(async (tx) => {
      const orden = await tx.ordenCompra.findUnique({
        where: { id },
        include: { renglones: true },
      });
      if (!orden) {
        throw new NotFoundException(`No existe la orden de compra con id ${id}`);
      }

      for (const renglon of orden.renglones) {
        // Los renglones de equipo no mueven stock: al recibirlos se da de alta
        // una ficha por unidad, que es otro camino. Se saltean aca para que la
        // parte de stock siga siendo exactamente la de antes.
        if (!renglon.materialId) {
          await this.altaDeEquipos(tx, renglon, orden.proveedorId, fechaRecepcion);
          continue;
        }

        const materialId = renglon.materialId;

        // Lock de la fila del material antes de leer su stock.
        const filas = await tx.$queryRaw<{ stockActual: Prisma.Decimal }[]>`
          SELECT "stockActual" FROM materiales WHERE id = ${materialId} FOR UPDATE
        `;
        if (filas.length === 0) {
          throw new NotFoundException(`No existe el material con id ${materialId}`);
        }

        const cantidad = aDecimal(renglon.cantidad);
        const nuevoStock = aDecimal(filas[0].stockActual).plus(cantidad);

        const movimiento = await tx.movimientoStock.create({
          data: {
            materialId,
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
          where: { id: materialId },
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
          remito,
          factura,
        },
        include: this.relaciones,
      });
    });
  }

  eliminar(id: string): Promise<unknown> {
    return this.prisma.ordenCompra.delete({ where: { id } });
  }
}
