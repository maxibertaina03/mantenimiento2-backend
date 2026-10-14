import { transicionar } from '../dominio/estado-equipo';
import { RepositorioEquipos } from '../puertos/repositorio-equipos';

/**
 * El estado de una máquina mientras está en un taller de afuera.
 *
 * Trabajos avisa cuándo sale y cuándo vuelve; acá se decide qué le pasa. Sale:
 * queda «En reparación», salvo que esté dada de baja, que es terminal. Vuelve:
 * pasa a «Operativo» solo si seguía «En reparación»; si mientras tanto alguien
 * la marcó fuera de servicio o la dio de baja, eso se respeta.
 */
export class EstadoPorTaller {
  constructor(private readonly repo: RepositorioEquipos) {}

  async salio(equipoId: string): Promise<void> {
    const equipo = await this.repo.buscarPorId(equipoId);
    if (!equipo || equipo.estado === 'DADO_DE_BAJA' || equipo.estado === 'EN_REPARACION') return;
    await this.repo.actualizar(equipoId, {
      estado: transicionar(equipo.estado, 'EN_REPARACION'),
    });
  }

  async volvio(equipoId: string): Promise<void> {
    const equipo = await this.repo.buscarPorId(equipoId);
    if (!equipo || equipo.estado !== 'EN_REPARACION') return;
    await this.repo.actualizar(equipoId, { estado: transicionar(equipo.estado, 'OPERATIVO') });
  }
}
