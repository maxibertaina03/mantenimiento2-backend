import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RepositorioUbicaciones, Ubicacion } from '../puertos/repositorio-ubicaciones';

@Injectable()
export class PrismaRepositorioUbicaciones implements RepositorioUbicaciones {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorNombre(nombre: string): Promise<Ubicacion | null> {
    // insensitive: en las carpetas hay "PRETRATAMIENTO DE LECHE" junto a
    // nombres en minúscula. Sin esto se crearía una ubicación al lado de la que
    // ya existe y los equipos quedarían repartidos entre las dos.
    const fila = await this.prisma.ubicacionEquipo.findFirst({
      where: { nombre: { equals: nombre.trim(), mode: 'insensitive' } },
      select: { id: true, nombre: true },
    });
    return fila;
  }

  async crear(nombre: string, orden: number): Promise<Ubicacion> {
    return this.prisma.ubicacionEquipo.create({
      data: { nombre: nombre.trim(), orden },
      select: { id: true, nombre: true },
    });
  }
}
