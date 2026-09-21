import { ConsultaEquipos, EquipoReferenciado } from '../puertos/consulta-equipos';

/** El catálogo de equipos de los tests: los que existen y nada más. */
export class ConsultaEquiposEnMemoria implements ConsultaEquipos {
  constructor(private readonly equipos: EquipoReferenciado[] = []) {}

  async buscarPorId(id: string): Promise<EquipoReferenciado | null> {
    return this.equipos.find((e) => e.id === id) ?? null;
  }
}
