import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ConsultaEquiposIt, EquipoItReferenciado } from '../puertos/consulta-equipos-it';

/**
 * Cómo se nombra un equipo de informática cuando hay que mostrarlo en una sola
 * línea.
 *
 * Es la misma regla que usa la pantalla de equipos IT, y está repetida a
 * propósito: el nombre no está guardado en ningún lado, se arma. Marca y modelo
 * salen del catálogo y pueden faltar —28 de los 65 equipos cargados no tienen
 * marca— y entonces el que identifica es el código interno, que es la etiqueta
 * pegada a la máquina.
 */
export function nombreDeEquipoIt(fila: {
  codigoInterno: string | null;
  marca: { nombre: string } | null;
  modelo: { nombre: string } | null;
  tipo: { nombre: string } | null;
}): string {
  const marcaYModelo = [fila.marca?.nombre, fila.modelo?.nombre].filter(Boolean).join(' ');
  return marcaYModelo || fila.codigoInterno || fila.tipo?.nombre || 'Equipo sin identificar';
}

/** Lo que traer para poder armar el nombre. Uno solo, para no repetirlo en cada repositorio. */
export const SELECT_NOMBRE_EQUIPO_IT = {
  codigoInterno: true,
  marca: { select: { nombre: true } },
  modelo: { select: { nombre: true } },
  tipo: { select: { nombre: true } },
} as const;

/** La capa anticorrupción contra el módulo de equipos de informática. */
@Injectable()
export class PrismaConsultaEquiposIt implements ConsultaEquiposIt {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorId(id: string): Promise<EquipoItReferenciado | null> {
    const fila = await this.prisma.equipoIT.findUnique({
      where: { id },
      select: { id: true, ...SELECT_NOMBRE_EQUIPO_IT },
    });
    if (!fila) return null;
    return { id: fila.id, nombre: nombreDeEquipoIt(fila), codigo: fila.codigoInterno };
  }
}
