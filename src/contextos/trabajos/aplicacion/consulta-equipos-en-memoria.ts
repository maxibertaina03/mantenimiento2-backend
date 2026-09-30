import {
  ConsultaEquipos,
  EquipoReferenciado,
  VentanaDeComponente,
} from '../puertos/consulta-equipos';

/** El catálogo de equipos de los tests: los que existen y nada más. */
export class ConsultaEquiposEnMemoria implements ConsultaEquipos {
  constructor(
    private readonly equipos: EquipoReferenciado[] = [],
    private readonly ventanas: Record<string, VentanaDeComponente[]> = {},
  ) {}

  async ventanasDeComponentes(equipoId: string): Promise<VentanaDeComponente[]> {
    return this.ventanas[equipoId] ?? [];
  }

  async buscarPorId(id: string): Promise<EquipoReferenciado | null> {
    return this.equipos.find((e) => e.id === id) ?? null;
  }
}
