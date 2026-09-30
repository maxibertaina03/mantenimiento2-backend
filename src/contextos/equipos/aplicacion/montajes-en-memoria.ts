import { Componente, Montaje, RepositorioMontajes } from '../puertos/montajes';
import { RepositorioEquiposEnMemoria } from './repositorio-en-memoria';

/**
 * Montajes en memoria, para probar los casos de uso sin base.
 *
 * Escribe `equipoPadreId` en el repositorio de equipos en memoria, igual que
 * el adaptador Prisma escribe la columna: así el caso de uso lee lo mismo que
 * leería de verdad.
 */
export class RepositorioMontajesEnMemoria implements RepositorioMontajes {
  readonly tramos: Montaje[] = [];

  constructor(private readonly equipos: RepositorioEquiposEnMemoria) {}

  private async fijarPadre(id: string, equipoPadreId: string | null): Promise<void> {
    const equipo = await this.equipos.buscarPorId(id);
    if (equipo) equipo.equipoPadreId = equipoPadreId;
  }

  async montar(datos: {
    componenteId: string;
    equipoPadreId: string;
    cuando: Date;
    motivo: string | null;
    registradoPorId: string | null;
  }): Promise<void> {
    for (const t of this.tramos) {
      if (t.componenteId === datos.componenteId && t.hasta === null) t.hasta = datos.cuando;
    }
    this.tramos.push({
      id: `mon-${this.tramos.length + 1}`,
      componenteId: datos.componenteId,
      equipoPadreId: datos.equipoPadreId,
      desde: datos.cuando,
      hasta: null,
      motivo: datos.motivo,
      componenteNombre: '',
      equipoPadreNombre: '',
      registradoPorNombre: null,
    });
    await this.fijarPadre(datos.componenteId, datos.equipoPadreId);
  }

  async desmontar(datos: { componenteId: string; cuando: Date; motivo: string | null }) {
    for (const t of this.tramos) {
      if (t.componenteId === datos.componenteId && t.hasta === null) t.hasta = datos.cuando;
    }
    await this.fijarPadre(datos.componenteId, null);
  }

  async componentes(equipoPadreId: string): Promise<Componente[]> {
    const abiertos = this.tramos.filter((t) => t.equipoPadreId === equipoPadreId && !t.hasta);
    const lista: Componente[] = [];
    for (const t of abiertos) {
      const e = await this.equipos.buscarPorId(t.componenteId);
      if (!e) continue;
      lista.push({
        id: e.id,
        nombre: e.nombre,
        estado: e.estado,
        tipoNombre: e.tipoNombre,
        clasificacion: e.clasificacion,
        montadoDesde: t.desde,
        cantidadComponentes: this.tramos.filter((x) => x.equipoPadreId === e.id && !x.hasta).length,
      });
    }
    return lista;
  }

  async tramosDelComponente(componenteId: string): Promise<Montaje[]> {
    return this.tramos
      .filter((t) => t.componenteId === componenteId)
      .sort((a, b) => b.desde.getTime() - a.desde.getTime());
  }

  async antecesores(equipoId: string): Promise<string[]> {
    const cadena: string[] = [];
    let actual = (await this.equipos.buscarPorId(equipoId))?.equipoPadreId ?? null;
    while (actual && cadena.length < 50) {
      cadena.push(actual);
      actual = (await this.equipos.buscarPorId(actual))?.equipoPadreId ?? null;
    }
    return cadena;
  }
}
