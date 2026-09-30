import { ErrorNoEncontrado } from '../dominio/errores';
import { EquipoParaMontar, validarDesmontaje, validarMontaje } from '../dominio/montaje';
import { Componente, Montaje, RepositorioMontajes } from '../puertos/montajes';
import { Reloj } from '../puertos/reloj';
import { RepositorioEquipos } from '../puertos/repositorio-equipos';

/**
 * Montar un equipo dentro de otro, trasladarlo y desmontarlo.
 *
 * Trasladar es montar en otra máquina: el repositorio cierra el tramo viejo y
 * abre el nuevo en el mismo momento, así nunca queda un rato "en ningún lado"
 * ni en dos máquinas a la vez.
 */
export class GestionarMontajes {
  constructor(
    private readonly montajes: RepositorioMontajes,
    private readonly equipos: RepositorioEquipos,
    private readonly reloj: Reloj,
  ) {}

  private async traer(id: string): Promise<EquipoParaMontar> {
    const equipo = await this.equipos.buscarPorId(id);
    if (!equipo) throw new ErrorNoEncontrado(`No existe el equipo con id ${id}`);
    return equipo;
  }

  async montar(
    componenteId: string,
    equipoPadreId: string,
    registradoPorId: string | null,
    motivo?: string | null,
  ): Promise<void> {
    const componente = await this.traer(componenteId);
    const maquina = await this.traer(equipoPadreId);
    validarMontaje(componente, maquina, await this.montajes.antecesores(equipoPadreId));

    await this.montajes.montar({
      componenteId,
      equipoPadreId,
      cuando: this.reloj.ahora(),
      motivo: motivo?.trim() || null,
      registradoPorId,
    });
  }

  async desmontar(componenteId: string, motivo?: string | null): Promise<void> {
    validarDesmontaje(await this.traer(componenteId));
    await this.montajes.desmontar({
      componenteId,
      cuando: this.reloj.ahora(),
      motivo: motivo?.trim() || null,
    });
  }

  async componentes(equipoPadreId: string): Promise<Componente[]> {
    await this.traer(equipoPadreId);
    return this.montajes.componentes(equipoPadreId);
  }

  async historial(componenteId: string): Promise<Montaje[]> {
    await this.traer(componenteId);
    return this.montajes.tramosDelComponente(componenteId);
  }
}
