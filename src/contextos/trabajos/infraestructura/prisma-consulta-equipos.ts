import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  ConsultaEquipos,
  EquipoReferenciado,
  VentanaDeComponente,
} from '../puertos/consulta-equipos';

/**
 * Hasta cuántos niveles se baja: desnatadora → bomba → motor → … Las reglas
 * de equipos impiden los círculos; esto es la red por si alguno entrara por
 * fuera del sistema.
 */
const NIVELES_MAXIMOS = 10;

/** El más tardío de dos comienzos y el más temprano de dos finales (null = sigue). */
function interseccion(
  a: { desde: Date; hasta: Date | null },
  b: { desde: Date; hasta: Date | null },
): { desde: Date; hasta: Date | null } | null {
  const desde = a.desde > b.desde ? a.desde : b.desde;
  const hasta =
    a.hasta === null ? b.hasta : b.hasta === null ? a.hasta : a.hasta < b.hasta ? a.hasta : b.hasta;
  if (hasta !== null && desde >= hasta) return null;
  return { desde, hasta };
}

@Injectable()
export class PrismaConsultaEquipos implements ConsultaEquipos {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorId(id: string): Promise<EquipoReferenciado | null> {
    const fila = await this.prisma.equipo.findUnique({
      where: { id },
      select: { id: true, nombre: true, codigoInterno: true },
    });
    if (!fila) return null;
    return { id: fila.id, nombre: fila.nombre, codigo: fila.codigoInterno };
  }

  /**
   * Baja nivel por nivel. El lapso de un motor dentro de la bomba se recorta
   * al lapso en que esa bomba estuvo en la desnatadora: si el motor estaba en
   * la bomba cuando la bomba todavía no había llegado, ese trabajo no es de
   * la desnatadora.
   */
  async ventanasDeComponentes(equipoId: string): Promise<VentanaDeComponente[]> {
    const resultado: VentanaDeComponente[] = [];
    let nivel: { id: string; desde: Date; hasta: Date | null }[] = [
      { id: equipoId, desde: new Date(0), hasta: null },
    ];

    for (let n = 0; n < NIVELES_MAXIMOS && nivel.length > 0; n++) {
      const tramos = await this.prisma.montajeEquipo.findMany({
        where: { equipoPadreId: { in: [...new Set(nivel.map((x) => x.id))] } },
        select: { componenteId: true, equipoPadreId: true, desde: true, hasta: true },
      });

      const siguiente: typeof nivel = [];
      for (const tramo of tramos) {
        // La misma máquina puede aparecer con varios lapsos (se sacó y volvió).
        for (const ventana of nivel.filter((v) => v.id === tramo.equipoPadreId)) {
          const lapso = interseccion(tramo, ventana);
          if (!lapso) continue;
          resultado.push({ equipoId: tramo.componenteId, ...lapso });
          siguiente.push({ id: tramo.componenteId, ...lapso });
        }
      }
      nivel = siguiente;
    }
    return resultado;
  }
}
