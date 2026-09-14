import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { sonElMismoNombre } from '../../../common/dominio/nombres';
import { RepositorioUbicaciones, Ubicacion } from '../puertos/repositorio-ubicaciones';

@Injectable()
export class PrismaRepositorioUbicaciones implements RepositorioUbicaciones {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * La ubicación que ya se llama así, si existe. Es lo que hace que reimportar
   * la misma planilla no duplique nada.
   *
   * Se compara en memoria: en las carpetas hay "PRETRATAMIENTO DE LECHE" junto
   * a nombres en minúscula, y también con acentos y sin ellos. Postgres resuelve
   * lo primero con `mode: 'insensitive'` pero no lo segundo, así que
   * «Elaboracion» no encontraba a «Elaboración» y la importación creaba una
   * ubicación al lado de la que ya existía, con los equipos repartidos entre
   * las dos. Son decenas de filas. Ver `common/dominio/nombres`.
   */
  async buscarPorNombre(nombre: string): Promise<Ubicacion | null> {
    const filas = await this.prisma.ubicacionEquipo.findMany({
      select: { id: true, nombre: true },
    });
    return filas.find((f) => sonElMismoNombre(f.nombre, nombre)) ?? null;
  }

  async crear(nombre: string, orden: number): Promise<Ubicacion> {
    return this.prisma.ubicacionEquipo.create({
      data: { nombre: nombre.trim(), orden },
      select: { id: true, nombre: true },
    });
  }
}
