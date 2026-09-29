import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { aDecimal } from '../../../../common/dominio/decimal';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import {
  CambiosMaterial,
  FiltroMateriales,
  MaterialConHistorial,
  MaterialConRelaciones,
  NuevoMaterial,
  OrdenMateriales,
  RepositorioMateriales,
} from '../../puertos/repositorio-materiales';

/**
 * Traduce el filtro del pañol al `where` de Prisma.
 *
 * Es exactamente lo que armaba el service antes de mover el módulo; ahora vive
 * acá porque es la única capa que sabe cómo se guarda. Exportada para poder
 * probarla sin base.
 */
export function aWhere(filtro: FiltroMateriales): Prisma.MaterialWhereInput {
  const where: Prisma.MaterialWhereInput = {};

  // Por defecto el listado muestra solo los materiales en uso. Los
  // desactivados se siguen pudiendo mirar pidiéndolos.
  if (filtro.mostrar === 'activos' || filtro.mostrar === undefined) where.activo = true;
  else if (filtro.mostrar === 'inactivos') where.activo = false;

  if (filtro.buscar) {
    where.nombre = { contains: filtro.buscar, mode: 'insensitive' };
  }
  if (filtro.categoriaId) where.categoriaId = filtro.categoriaId;

  // sinUnidad gana sobre unidadId: pedir las dos cosas es contradictorio, y
  // dejar el `unidadId` filtraría por una unidad Y por no tener ninguna,
  // devolviendo siempre vacío sin explicar por qué.
  if (filtro.sinUnidad) where.unidadId = null;
  else if (filtro.unidadId) where.unidadId = filtro.unidadId;

  if (filtro.stockMin !== undefined || filtro.stockMax !== undefined) {
    where.stockActual = {
      ...(filtro.stockMin !== undefined ? { gte: aDecimal(filtro.stockMin) } : {}),
      ...(filtro.stockMax !== undefined ? { lte: aDecimal(filtro.stockMax) } : {}),
    };
  }

  if (filtro.estanteriaId) where.estanteriaId = filtro.estanteriaId;
  // Los que todavía no se ubicaron: es la lista para recorrer el depósito.
  if (filtro.sinUbicacion) where.estanteriaId = null;

  // Los que faltan etiquetar: es la lista que se manda a imprimir.
  if (filtro.sinQr) where.qrGeneradoEn = null;

  if (filtro.soloIds) where.id = { in: filtro.soloIds };

  return where;
}

/**
 * Orden del listado.
 *
 * El nombre queda siempre como criterio final: con muchos materiales
 * empatados —por ejemplo todos en stock 0— sin un desempate estable las
 * páginas 1 y 2 podrían repetir o saltear filas.
 */
export function aOrden(orden: OrdenMateriales): Prisma.MaterialOrderByWithRelationInput[] {
  const dir = orden.direccion ?? 'asc';
  switch (orden.campo) {
    case 'stock':
      return [{ stockActual: dir }, { nombre: 'asc' }];
    case 'categoria':
      return [{ categoria: { nombre: dir } }, { nombre: 'asc' }];
    case 'unidad':
      return [{ unidad: { nombre: dir } }, { nombre: 'asc' }];
    default:
      return [{ nombre: dir }];
  }
}

/** Lo que se guarda al dar de alta. `stockActual` no está: arranca en 0 y solo cambia vía movimientos. */
export function aDatosDeAlta(datos: NuevoMaterial): Prisma.MaterialCreateInput {
  return {
    nombre: datos.nombre,
    stockMinimo: datos.stockMinimo,
    notas: datos.notas,
    categoria: { connect: { id: datos.categoriaId } },
    unidad: { connect: { id: datos.unidadId } },
    ...(datos.ubicacion
      ? {
          estanteria: { connect: { id: datos.ubicacion.estanteriaId } },
          fila: datos.ubicacion.fila,
        }
      : {}),
  };
}

/** Lo que cambia al editar. Lo que viene `undefined`, Prisma no lo toca. */
export function aDatosDeCambio(cambios: CambiosMaterial): Prisma.MaterialUpdateInput {
  return {
    nombre: cambios.nombre,
    stockMinimo: cambios.stockMinimo,
    notas: cambios.notas,
    ...(cambios.categoriaId ? { categoria: { connect: { id: cambios.categoriaId } } } : {}),
    ...(cambios.unidadId ? { unidad: { connect: { id: cambios.unidadId } } } : {}),
    ...(cambios.estanteriaId !== undefined
      ? cambios.estanteriaId
        ? { estanteria: { connect: { id: cambios.estanteriaId } } }
        : { estanteria: { disconnect: true } }
      : {}),
    ...(cambios.fila !== undefined ? { fila: cambios.fila } : {}),
    ...(cambios.activo !== undefined ? { activo: cambios.activo } : {}),
  };
}

/** Adaptador Prisma del puerto `RepositorioMateriales`. */
@Injectable()
export class PrismaRepositorioMateriales implements RepositorioMateriales {
  constructor(private readonly prisma: PrismaService) {}

  /** La unidad viene del catálogo; el DTO expone su símbolo junto a la cantidad. */
  private readonly relaciones = {
    categoria: true,
    unidad: true,
    // Solo el nombre: es lo único que se muestra de la estantería.
    estanteria: { select: { nombre: true } },
  } as const;

  /**
   * Los nombres de todos los materiales, para detectar duplicados.
   *
   * Trae el padrón entero y no solo los que coinciden sin mayúsculas, porque
   * Postgres tampoco compara sin acentos: sin la extensión `unaccent`, que no
   * está instalada, una consulta por «Valvula» nunca devuelve «Válvula» y el
   * duplicado se cuela. La comparación fina se hace después en memoria.
   *
   * Son dos columnas cortas de novecientas filas y solo se pide al crear o
   * renombrar, que no es una operación frecuente.
   */
  listarNombres(): Promise<{ id: string; nombre: string }[]> {
    return this.prisma.material.findMany({ select: { id: true, nombre: true } });
  }

  crear(datos: NuevoMaterial): Promise<MaterialConRelaciones> {
    return this.prisma.material.create({ data: aDatosDeAlta(datos), include: this.relaciones });
  }

  listar(
    filtro: FiltroMateriales,
    orden: OrdenMateriales,
    skip: number,
    take: number,
  ): Promise<MaterialConRelaciones[]> {
    return this.prisma.material.findMany({
      where: aWhere(filtro),
      skip,
      take,
      include: this.relaciones,
      orderBy: aOrden(orden),
    });
  }

  contar(filtro: FiltroMateriales): Promise<number> {
    return this.prisma.material.count({ where: aWhere(filtro) });
  }

  buscarPorId(id: string): Promise<MaterialConRelaciones | null> {
    return this.prisma.material.findUnique({ where: { id }, include: this.relaciones });
  }

  /** Material con su historial completo de movimientos (más recientes primero). */
  buscarConHistorial(id: string): Promise<MaterialConHistorial | null> {
    return this.prisma.material.findUnique({
      where: { id },
      include: {
        ...this.relaciones,
        movimientos: { orderBy: { fecha: 'desc' } },
      },
    });
  }

  /**
   * Materiales cuyo stockActual <= stockMinimo.
   * Se compara columna contra columna con SQL crudo y luego se hidratan con Prisma.
   */
  async buscarBajoStock(): Promise<MaterialConRelaciones[]> {
    const ids = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM materiales
      WHERE activo = true AND "stockMinimo" > 0 AND "stockActual" <= "stockMinimo"
    `;
    if (ids.length === 0) return [];
    return this.prisma.material.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
      include: this.relaciones,
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Ids de los materiales en (o por debajo de) su stock mínimo.
   *
   * Va en SQL crudo porque compara dos columnas entre sí, y Prisma no expresa
   * `stockActual <= stockMinimo` en un `where`. Se devuelven solo los ids para
   * poder combinar este filtro con los demás y con la paginación.
   */
  async idsBajoStock(): Promise<string[]> {
    const filas = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM materiales
      WHERE activo = true AND "stockMinimo" > 0 AND "stockActual" <= "stockMinimo"
    `;
    return filas.map((f) => f.id);
  }

  actualizar(id: string, cambios: CambiosMaterial): Promise<MaterialConRelaciones> {
    return this.prisma.material.update({
      where: { id },
      data: aDatosDeCambio(cambios),
      include: this.relaciones,
    });
  }

  async eliminar(id: string): Promise<void> {
    await this.prisma.material.delete({ where: { id } });
  }

  async marcarQrGenerado(ids: string[], cuando: Date): Promise<number> {
    const { count } = await this.prisma.material.updateMany({
      where: { id: { in: ids } },
      data: { qrGeneradoEn: cuando },
    });
    return count;
  }

  /** Cuántos materiales todavía no tienen unidad cargada. */
  contarSinUnidad(): Promise<number> {
    return this.prisma.material.count({ where: { unidadId: null } });
  }

  /**
   * Materiales en uso a los que nadie les puso un stock mínimo.
   *
   * Son los que la alerta de bajo stock NO puede avisar: la regla exige un
   * mínimo definido, así que sin él el material podría quedar en cero sin que
   * nadie se entere.
   */
  contarSinStockMinimo(): Promise<number> {
    return this.prisma.material.count({ where: { activo: true, stockMinimo: 0 } });
  }

  /**
   * Asigna una unidad a muchos materiales de una.
   *
   * `soloSinUnidad` es el modo normal: completa los huecos sin pisar lo que
   * alguien ya corrigió a mano.
   */
  async asignarUnidadMasiva(unidadId: string, soloSinUnidad: boolean): Promise<number> {
    const { count } = await this.prisma.material.updateMany({
      where: soloSinUnidad ? { unidadId: null } : {},
      data: { unidadId },
    });
    return count;
  }

  contarMovimientos(id: string): Promise<number> {
    return this.prisma.movimientoStock.count({ where: { materialId: id } });
  }
}
