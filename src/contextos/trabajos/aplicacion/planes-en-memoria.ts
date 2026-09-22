import { PlanesDeMantenimiento } from '../puertos/planes-de-mantenimiento';

/** Los planes de los tests: cuáles existen y qué se les avisó. */
export class PlanesEnMemoria implements PlanesDeMantenimiento {
  /** Lo que se fue avisando, para revisarlo en el test. */
  readonly avisos: { planId: string; fecha: Date }[] = [];

  constructor(private readonly planes: { id: string; equipoId: string }[] = []) {}

  async esDelEquipo(planId: string, equipoId: string): Promise<boolean> {
    return this.planes.some((p) => p.id === planId && p.equipoId === equipoId);
  }

  async registrarTrabajo(planId: string, fechaDelTrabajo: Date): Promise<void> {
    this.avisos.push({ planId, fecha: fechaDelTrabajo });
  }
}
