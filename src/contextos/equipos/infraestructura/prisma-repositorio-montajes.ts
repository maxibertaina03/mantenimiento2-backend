import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EstadoEquipo } from '../dominio/estado-equipo';
import { Componente, Montaje, RepositorioMontajes } from '../puertos/montajes';

/**
 * Un tope para subir por el árbol. Las reglas impiden los círculos, pero si
 * alguna vez entrara uno por fuera del sistema, esto evita quedarse dando
 * vueltas para siempre.
 */
const NIVELES_MAXIMOS = 50;

/** Adaptador Prisma del puerto `RepositorioMontajes`. */
@Injectable()
export class PrismaRepositorioMontajes implements RepositorioMontajes {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * La columna `equipoPadreId` y el tramo abierto se escriben juntos: si uno
   * cambiara sin el otro, la ficha diría una máquina y el historial otra.
   */
  async montar(datos: {
    componenteId: string;
    equipoPadreId: string;
    cuando: Date;
    motivo: string | null;
    registradoPorId: string | null;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Si estaba en otra máquina, ese tramo termina justo cuando empieza este.
      await tx.montajeEquipo.updateMany({
        where: { componenteId: datos.componenteId, hasta: null },
        data: { hasta: datos.cuando },
      });
      await tx.montajeEquipo.create({
        data: {
          componenteId: datos.componenteId,
          equipoPadreId: datos.equipoPadreId,
          desde: datos.cuando,
          motivo: datos.motivo,
          registradoPorId: datos.registradoPorId,
        },
      });
      await tx.equipo.update({
        where: { id: datos.componenteId },
        data: { equipoPadreId: datos.equipoPadreId },
      });
    });
  }

  async desmontar(datos: {
    componenteId: string;
    cuando: Date;
    motivo: string | null;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const abiertos = await tx.montajeEquipo.findMany({
        where: { componenteId: datos.componenteId, hasta: null },
        select: { id: true, motivo: true },
      });
      for (const tramo of abiertos) {
        await tx.montajeEquipo.update({
          where: { id: tramo.id },
          data: {
            hasta: datos.cuando,
            // El motivo de la salida se suma al de la entrada: los dos cuentan
            // la historia del tramo.
            ...(datos.motivo
              ? {
                  motivo: tramo.motivo
                    ? `${tramo.motivo} · Sale: ${datos.motivo}`
                    : `Sale: ${datos.motivo}`,
                }
              : {}),
          },
        });
      }
      await tx.equipo.update({
        where: { id: datos.componenteId },
        data: { equipoPadreId: null },
      });
    });
  }

  async componentes(equipoPadreId: string): Promise<Componente[]> {
    const filas = await this.prisma.equipo.findMany({
      where: { equipoPadreId },
      orderBy: { nombre: 'asc' },
      include: {
        tipo: { select: { nombre: true } },
        _count: { select: { componentes: true } },
        montajesComoPieza: {
          where: { hasta: null },
          select: { desde: true },
          take: 1,
        },
      },
    });
    return filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      estado: f.estado as EstadoEquipo,
      tipoNombre: f.tipo?.nombre ?? null,
      clasificacion: f.clasificacion,
      montadoDesde: f.montajesComoPieza[0]?.desde ?? null,
      cantidadComponentes: f._count?.componentes ?? 0,
    }));
  }

  async tramosDelComponente(componenteId: string): Promise<Montaje[]> {
    const filas = await this.prisma.montajeEquipo.findMany({
      where: { componenteId },
      orderBy: { desde: 'desc' },
      include: {
        componente: { select: { nombre: true } },
        equipoPadre: { select: { nombre: true } },
        registradoPor: { select: { nombre: true } },
      },
    });
    return filas.map((f) => ({
      id: f.id,
      componenteId: f.componenteId,
      equipoPadreId: f.equipoPadreId,
      desde: f.desde,
      hasta: f.hasta,
      motivo: f.motivo,
      componenteNombre: f.componente?.nombre ?? '',
      equipoPadreNombre: f.equipoPadre?.nombre ?? '',
      registradoPorNombre: f.registradoPor?.nombre ?? null,
    }));
  }

  async antecesores(equipoId: string): Promise<string[]> {
    const cadena: string[] = [];
    let actual: string | null = equipoId;
    for (let nivel = 0; nivel < NIVELES_MAXIMOS && actual; nivel++) {
      const fila: { equipoPadreId: string | null } | null = await this.prisma.equipo.findUnique({
        where: { id: actual },
        select: { equipoPadreId: true },
      });
      actual = fila?.equipoPadreId ?? null;
      if (actual) cadena.push(actual);
    }
    return cadena;
  }
}
