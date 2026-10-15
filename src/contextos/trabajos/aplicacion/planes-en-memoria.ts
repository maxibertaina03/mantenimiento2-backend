import { PlanesDeMantenimiento, VencimientoDePlan } from '../puertos/planes-de-mantenimiento';

/** Los planes de los tests: cuáles existen y qué se les avisó. */
export class PlanesEnMemoria implements PlanesDeMantenimiento {
  /** Lo que se fue avisando, para revisarlo en el test. */
  readonly avisos: { planId: string; fecha: Date; yaHechoHasta?: Date }[] = [];
  /** Lo que se fue postergando. */
  readonly postergaciones: { planId: string; fecha: Date }[] = [];
  /**
   * Si está, `postergar` lo usa para decidir (correr la fecha o rechazar),
   * como haría el plan de verdad. Sin esto, acepta la fecha tal cual.
   */
  reglaDePostergar?: (planId: string, fecha: Date) => Date;

  constructor(
    private readonly planes: { id: string; equipoId: string }[] = [],
    /** Los vencimientos que el test quiere que el calendario encuentre. */
    private readonly vencimientos: VencimientoDePlan[] = [],
  ) {}

  async vencimientosEntre(desde: Date, hasta: Date): Promise<VencimientoDePlan[]> {
    return this.vencimientos.filter((v) => v.fecha >= desde && v.fecha <= hasta);
  }

  async esDelEquipo(planId: string, equipoId: string): Promise<boolean> {
    return this.planes.some((p) => p.id === planId && p.equipoId === equipoId);
  }

  async registrarTrabajo(
    planId: string,
    fechaDelTrabajo: Date,
    yaHechoHasta?: Date,
  ): Promise<void> {
    this.avisos.push(
      yaHechoHasta
        ? { planId, fecha: fechaDelTrabajo, yaHechoHasta }
        : { planId, fecha: fechaDelTrabajo },
    );
  }

  async postergar(planId: string, nuevaFecha: Date): Promise<Date> {
    const fecha = this.reglaDePostergar ? this.reglaDePostergar(planId, nuevaFecha) : nuevaFecha;
    this.postergaciones.push({ planId, fecha });
    return fecha;
  }
}
