import { ConsultaEquiposIt, EquipoItReferenciado } from '../puertos/consulta-equipos-it';

/** El inventario de informática de los tests: los que existen y nada más. */
export class ConsultaEquiposItEnMemoria implements ConsultaEquiposIt {
  constructor(private readonly equipos: EquipoItReferenciado[] = []) {}

  async buscarPorId(id: string): Promise<EquipoItReferenciado | null> {
    return this.equipos.find((e) => e.id === id) ?? null;
  }
}
