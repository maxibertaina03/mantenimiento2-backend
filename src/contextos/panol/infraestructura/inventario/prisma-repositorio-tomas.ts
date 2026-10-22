import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import {
  EstadoToma,
  RenglonToma,
  ResultadoRenglon,
  TomaInventario,
  Ubicacion,
} from '../../dominio/toma-inventario';
import {
  RenglonConMaterial,
  RepositorioTomas,
  ReubicacionConNombres,
  TomaConRelaciones,
} from '../../puertos/repositorio-tomas';

const RELACIONES_TOMA = {
  categoria: { select: { nombre: true } },
  estanteria: { select: { nombre: true } },
  abiertaPor: { select: { nombre: true } },
  cerradaPor: { select: { nombre: true } },
  _count: { select: { renglones: true } },
} as const;

const RELACIONES_RENGLON = {
  material: {
    select: {
      nombre: true,
      stockActual: true,
      estanteriaId: true,
      fila: true,
      unidad: { select: { simbolo: true } },
      estanteria: { select: { nombre: true, orden: true } },
    },
  },
  contadoPor: { select: { nombre: true } },
} as const;

type FilaToma = Prisma.TomaInventarioGetPayload<{ include: typeof RELACIONES_TOMA }>;
type FilaRenglon = Prisma.RenglonTomaGetPayload<{ include: typeof RELACIONES_RENGLON }>;

const aNumero = (d: Prisma.Decimal | null) => (d === null ? null : d.toNumber());
const aDecimal = (n: number | null | undefined) =>
  n === null || n === undefined ? n : new Prisma.Decimal(n.toFixed(3));

/** El único archivo de la toma de inventario que sabe que existe Prisma. */
@Injectable()
export class PrismaRepositorioTomas implements RepositorioTomas {
  constructor(private readonly prisma: PrismaService) {}

  private async tomaADominio(fila: FilaToma): Promise<TomaConRelaciones> {
    const contados = await this.prisma.renglonToma.count({
      where: { tomaId: fila.id, contado: { not: null } },
    });
    return {
      id: fila.id,
      numero: fila.numero,
      categoriaId: fila.categoriaId,
      estanteriaId: fila.estanteriaId,
      estado: fila.estado as EstadoToma,
      notas: fila.notas,
      abiertaEn: fila.abiertaEn,
      abiertaPorId: fila.abiertaPorId,
      cerradaEn: fila.cerradaEn,
      cerradaPorId: fila.cerradaPorId,
      motivoAnulacion: fila.motivoAnulacion,
      categoriaNombre: fila.categoria?.nombre ?? null,
      estanteriaNombre: fila.estanteria?.nombre ?? null,
      abiertaPorNombre: fila.abiertaPor?.nombre ?? null,
      cerradaPorNombre: fila.cerradaPor?.nombre ?? null,
      totalRenglones: fila._count.renglones,
      contados,
    };
  }

  private renglonADominio(fila: FilaRenglon): RenglonConMaterial {
    return {
      id: fila.id,
      tomaId: fila.tomaId,
      materialId: fila.materialId,
      contado: aNumero(fila.contado),
      stockAlContar: aNumero(fila.stockAlContar),
      contadoEn: fila.contadoEn,
      contadoPorId: fila.contadoPorId,
      resultado: fila.resultado as ResultadoRenglon | null,
      movimientoId: fila.movimientoId,
      materialNombre: fila.material.nombre,
      unidad: fila.material.unidad?.simbolo ?? 'u',
      estanteriaId: fila.material.estanteriaId,
      estanteriaNombre: fila.material.estanteria?.nombre ?? null,
      fila: fila.material.fila,
      stockActual: fila.material.stockActual.toNumber(),
      contadoPorNombre: fila.contadoPor?.nombre ?? null,
    };
  }

  async materialesDelAlcance(alcance: {
    categoriaId: string | null;
    estanteriaId: string | null;
  }): Promise<string[]> {
    const filas = await this.prisma.material.findMany({
      where: {
        activo: true,
        ...(alcance.categoriaId ? { categoriaId: alcance.categoriaId } : {}),
        ...(alcance.estanteriaId ? { estanteriaId: alcance.estanteriaId } : {}),
      },
      select: { id: true },
    });
    return filas.map((f) => f.id);
  }

  /**
   * El siguiente número de la serie, con el mismo contador que las órdenes:
   * un INSERT … ON CONFLICT es una sola sentencia atómica, sin la carrera de
   * «leer el máximo y sumarle uno».
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
    toma: Omit<TomaInventario, 'id' | 'numero'>,
    materialIds: string[],
  ): Promise<TomaConRelaciones> {
    const fila = await this.prisma.$transaction(async (tx) => {
      const serie = `TI-${toma.abiertaEn.getFullYear()}`;
      const correlativo = await this.siguienteNumero(tx, serie);
      const creada = await tx.tomaInventario.create({
        data: { ...toma, numero: `${serie}-${String(correlativo).padStart(4, '0')}` },
      });
      await tx.renglonToma.createMany({
        data: materialIds.map((materialId) => ({ tomaId: creada.id, materialId })),
      });
      return tx.tomaInventario.findUniqueOrThrow({
        where: { id: creada.id },
        include: RELACIONES_TOMA,
      });
    });
    return this.tomaADominio(fila);
  }

  async listar(): Promise<TomaConRelaciones[]> {
    const filas = await this.prisma.tomaInventario.findMany({
      orderBy: { abiertaEn: 'desc' },
      take: 100,
      include: RELACIONES_TOMA,
    });
    return Promise.all(filas.map((f) => this.tomaADominio(f)));
  }

  async buscarPorId(id: string): Promise<TomaConRelaciones | null> {
    const fila = await this.prisma.tomaInventario.findUnique({
      where: { id },
      include: RELACIONES_TOMA,
    });
    return fila ? this.tomaADominio(fila) : null;
  }

  async actualizar(id: string, cambios: Partial<TomaInventario>): Promise<TomaConRelaciones> {
    // El id y el número no se cambian nunca.
    const datos = { ...cambios };
    delete datos.id;
    delete datos.numero;
    const fila = await this.prisma.tomaInventario.update({
      where: { id },
      data: datos,
      include: RELACIONES_TOMA,
    });
    return this.tomaADominio(fila);
  }

  async renglones(tomaId: string): Promise<RenglonConMaterial[]> {
    const filas = await this.prisma.renglonToma.findMany({
      where: { tomaId },
      include: RELACIONES_RENGLON,
    });
    // Como se recorre el pañol: estantería (por su orden), fila, nombre. Lo
    // que no tiene ubicación va al final.
    const clave = (f: FilaRenglon) => [
      f.material.estanteria ? f.material.estanteria.orden : Number.MAX_SAFE_INTEGER,
      f.material.estanteria?.nombre ?? '',
      f.material.fila ?? Number.MAX_SAFE_INTEGER,
      f.material.nombre.toLocaleLowerCase('es'),
    ];
    filas.sort((a, b) => {
      const ka = clave(a);
      const kb = clave(b);
      for (let i = 0; i < ka.length; i++) {
        if (ka[i] < kb[i]) return -1;
        if (ka[i] > kb[i]) return 1;
      }
      return 0;
    });
    return filas.map((f) => this.renglonADominio(f));
  }

  async buscarRenglon(id: string): Promise<RenglonConMaterial | null> {
    const fila = await this.prisma.renglonToma.findUnique({
      where: { id },
      include: RELACIONES_RENGLON,
    });
    return fila ? this.renglonADominio(fila) : null;
  }

  async actualizarRenglon(id: string, cambios: Partial<RenglonToma>): Promise<RenglonConMaterial> {
    const fila = await this.prisma.renglonToma.update({
      where: { id },
      data: {
        ...(cambios.contado !== undefined ? { contado: aDecimal(cambios.contado) } : {}),
        ...(cambios.stockAlContar !== undefined
          ? { stockAlContar: aDecimal(cambios.stockAlContar) }
          : {}),
        ...(cambios.contadoEn !== undefined ? { contadoEn: cambios.contadoEn } : {}),
        ...(cambios.contadoPorId !== undefined ? { contadoPorId: cambios.contadoPorId } : {}),
        ...(cambios.resultado !== undefined ? { resultado: cambios.resultado } : {}),
        ...(cambios.movimientoId !== undefined ? { movimientoId: cambios.movimientoId } : {}),
      },
      include: RELACIONES_RENGLON,
    });
    return this.renglonADominio(fila);
  }

  async seMovioDespues(materialId: string, desde: Date): Promise<boolean> {
    const cuantos = await this.prisma.movimientoStock.count({
      where: { materialId, creadoEn: { gt: desde } },
    });
    return cuantos > 0;
  }

  async estanteriaActiva(id: string): Promise<boolean> {
    const estanteria = await this.prisma.estanteriaMaterial.findUnique({
      where: { id },
      select: { activo: true },
    });
    return estanteria?.activo ?? false;
  }

  async reubicar(datos: {
    tomaId: string;
    materialId: string;
    desde: Ubicacion;
    hacia: Ubicacion;
    hechaEn: Date;
    hechaPorId: string | null;
  }): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.material.update({
        where: { id: datos.materialId },
        data: { estanteriaId: datos.hacia.estanteriaId, fila: datos.hacia.fila },
      }),
      this.prisma.reubicacionToma.create({
        data: {
          tomaId: datos.tomaId,
          materialId: datos.materialId,
          estanteriaAnteriorId: datos.desde.estanteriaId,
          filaAnterior: datos.desde.fila,
          estanteriaNuevaId: datos.hacia.estanteriaId,
          filaNueva: datos.hacia.fila,
          hechaEn: datos.hechaEn,
          hechaPorId: datos.hechaPorId,
        },
      }),
    ]);
  }

  async reubicaciones(tomaId: string): Promise<ReubicacionConNombres[]> {
    const filas = await this.prisma.reubicacionToma.findMany({
      where: { tomaId },
      orderBy: { hechaEn: 'asc' },
      include: {
        material: { select: { nombre: true } },
        estanteriaAnterior: { select: { nombre: true } },
        estanteriaNueva: { select: { nombre: true } },
        hechaPor: { select: { nombre: true } },
      },
    });
    return filas.map((f) => ({
      id: f.id,
      materialId: f.materialId,
      materialNombre: f.material.nombre,
      desdeEstanteria: f.estanteriaAnterior?.nombre ?? null,
      desdeFila: f.filaAnterior,
      haciaEstanteria: f.estanteriaNueva?.nombre ?? null,
      haciaFila: f.filaNueva,
      hechaEn: f.hechaEn,
      hechaPorNombre: f.hechaPor?.nombre ?? null,
    }));
  }
}
