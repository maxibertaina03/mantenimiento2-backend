import { Injectable } from '@nestjs/common';
import { aDecimal, aNumero } from '../../../common/dominio/decimal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EstadoEquipo } from '../dominio/estado-equipo';
import {
  EquipoQueLoUsa,
  MaterialDelPanol,
  RepositorioRepuestos,
  RepuestoDeEquipo,
} from '../puertos/repuestos';

/**
 * La lista de repuestos de cada equipo, en Postgres.
 *
 * Lee del pañol el nombre, la unidad, el stock y la ubicación del material:
 * es lectura para mostrar la lista, no se escribe nada en el pañol.
 */
@Injectable()
export class PrismaRepositorioRepuestos implements RepositorioRepuestos {
  constructor(private readonly prisma: PrismaService) {}

  async delEquipo(equipoId: string): Promise<RepuestoDeEquipo[]> {
    const filas = await this.prisma.repuestoEquipo.findMany({
      where: { equipoId },
      orderBy: { material: { nombre: 'asc' } },
      include: {
        material: {
          select: {
            nombre: true,
            stockActual: true,
            stockMinimo: true,
            activo: true,
            fila: true,
            unidad: { select: { simbolo: true } },
            estanteria: { select: { nombre: true } },
          },
        },
      },
    });

    return filas.map((f) => {
      const stockActual = aNumero(f.material.stockActual);
      const stockMinimo = aNumero(f.material.stockMinimo);
      const estanteria = f.material.estanteria?.nombre;
      return {
        id: f.id,
        equipoId: f.equipoId,
        materialId: f.materialId,
        materialNombre: f.material.nombre,
        unidad: f.material.unidad?.simbolo ?? '',
        cantidad: f.cantidad === null ? null : aNumero(f.cantidad),
        notas: f.notas,
        stockActual,
        stockMinimo,
        // La misma regla que el pañol (material-respuesta.dto.ts): hay un
        // mínimo cargado y no se llega.
        bajoStock: stockMinimo > 0 && stockActual <= stockMinimo,
        materialActivo: f.material.activo,
        ubicacion: estanteria
          ? `${estanteria}${f.material.fila ? ` · fila ${f.material.fila}` : ''}`
          : null,
        creadoEn: f.creadoEn,
      };
    });
  }

  async equiposQueLoUsan(materialId: string): Promise<EquipoQueLoUsa[]> {
    const filas = await this.prisma.repuestoEquipo.findMany({
      where: { materialId },
      orderBy: { equipo: { nombre: 'asc' } },
      include: {
        equipo: {
          select: {
            id: true,
            nombre: true,
            estado: true,
            fotoUrl: true,
            ubicacion: { select: { nombre: true } },
          },
        },
      },
    });
    return filas.map((f) => ({
      repuestoId: f.id,
      equipoId: f.equipo.id,
      equipoNombre: f.equipo.nombre,
      equipoEstado: f.equipo.estado as EstadoEquipo,
      ubicacionNombre: f.equipo.ubicacion?.nombre ?? null,
      fotoUrl: f.equipo.fotoUrl,
      cantidad: f.cantidad === null ? null : aNumero(f.cantidad),
      notas: f.notas,
    }));
  }

  async buscarMaterial(materialId: string): Promise<MaterialDelPanol | null> {
    return this.prisma.material.findUnique({
      where: { id: materialId },
      select: { id: true, nombre: true, activo: true },
    });
  }

  async buscar(id: string) {
    return this.prisma.repuestoEquipo.findUnique({
      where: { id },
      select: { id: true, equipoId: true, materialId: true },
    });
  }

  async existe(equipoId: string, materialId: string): Promise<boolean> {
    const fila = await this.prisma.repuestoEquipo.findUnique({
      where: { equipoId_materialId: { equipoId, materialId } },
      select: { id: true },
    });
    return fila !== null;
  }

  async agregar(datos: {
    equipoId: string;
    materialId: string;
    cantidad: number | null;
    notas: string | null;
    registradoPorId: string | null;
  }): Promise<void> {
    await this.prisma.repuestoEquipo.create({
      data: {
        equipoId: datos.equipoId,
        materialId: datos.materialId,
        cantidad: datos.cantidad === null ? null : aDecimal(datos.cantidad),
        notas: datos.notas,
        registradoPorId: datos.registradoPorId,
      },
    });
  }

  async actualizar(
    id: string,
    cambios: { cantidad?: number | null; notas?: string | null },
  ): Promise<void> {
    await this.prisma.repuestoEquipo.update({
      where: { id },
      data: {
        ...(cambios.cantidad === undefined
          ? {}
          : { cantidad: cambios.cantidad === null ? null : aDecimal(cambios.cantidad) }),
        ...(cambios.notas === undefined ? {} : { notas: cambios.notas }),
      },
    });
  }

  async quitar(id: string): Promise<void> {
    await this.prisma.repuestoEquipo.delete({ where: { id } });
  }
}
