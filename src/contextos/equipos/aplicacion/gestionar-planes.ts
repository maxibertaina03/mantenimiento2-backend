import { ErrorNoEncontrado } from '../dominio/errores';
import {
  DatosNuevoPlan,
  PlanConEstado,
  conEstado,
  crearPlan,
  ordenarPorUrgencia,
  proximaFechaDespuesDe,
} from '../dominio/plan-mantenimiento';
import { RepositorioEquipos } from '../puertos/repositorio-equipos';
import { PlanConEquipo, RepositorioPlanes } from '../puertos/repositorio-planes';
import { Reloj } from '../puertos/reloj';

export interface PlanDeEquipoConEstado extends PlanConEquipo {
  estado: PlanConEstado['estado'];
  diasParaVencer: number;
}

/**
 * Alta, edición y consulta de los planes de mantenimiento.
 *
 * El estado de cada plan (vencido, por vencer, al día) se calcula al leer
 * contra el reloj inyectado. Guardarlo obligaría a recalcular todos los planes
 * cada noche, y un plan al día pasa a vencido solo por el paso del tiempo.
 */
export class GestionarPlanes {
  constructor(
    private readonly planes: RepositorioPlanes,
    private readonly equipos: RepositorioEquipos,
    private readonly reloj: Reloj,
  ) {}

  async crear(datos: DatosNuevoPlan): Promise<PlanConEstado> {
    const equipo = await this.equipos.buscarPorId(datos.equipoId);
    if (!equipo) throw new ErrorNoEncontrado(`No existe el equipo con id ${datos.equipoId}`);

    const plan = await this.planes.crear(crearPlan(datos));
    return conEstado(plan, this.reloj.ahora());
  }

  async listarPorEquipo(equipoId: string): Promise<PlanConEstado[]> {
    const equipo = await this.equipos.buscarPorId(equipoId);
    if (!equipo) throw new ErrorNoEncontrado(`No existe el equipo con id ${equipoId}`);

    const hoy = this.reloj.ahora();
    return (await this.planes.listarPorEquipo(equipoId)).map((p) => conEstado(p, hoy));
  }

  async actualizar(
    id: string,
    cambios: {
      nombre?: string;
      tareas?: string | null;
      periodicidadDias?: number;
      proximaFecha?: Date;
      activo?: boolean;
    },
  ): Promise<PlanConEstado> {
    const actual = await this.planes.buscarPorId(id);
    if (!actual) throw new ErrorNoEncontrado(`No existe el plan con id ${id}`);

    // Se valida con los datos que quedarían: así "periodicidad 0" se rechaza
    // igual venga de un alta o de una edición.
    const validado = crearPlan({
      equipoId: actual.equipoId,
      nombre: cambios.nombre ?? actual.nombre,
      tareas: cambios.tareas !== undefined ? cambios.tareas : actual.tareas,
      periodicidadDias: cambios.periodicidadDias ?? actual.periodicidadDias,
      proximaFecha: cambios.proximaFecha ?? actual.proximaFecha,
    });

    const plan = await this.planes.actualizar(id, {
      ...validado,
      activo: cambios.activo ?? actual.activo,
    });
    return conEstado(plan, this.reloj.ahora());
  }

  async eliminar(id: string): Promise<void> {
    const plan = await this.planes.buscarPorId(id);
    if (!plan) throw new ErrorNoEncontrado(`No existe el plan con id ${id}`);
    await this.planes.eliminar(id);
  }

  /** Lo que vence, de lo más urgente a lo menos. Es la pantalla de trabajo diario. */
  async listarQueVencen(diasHaciaAdelante = 7): Promise<PlanDeEquipoConEstado[]> {
    const hoy = this.reloj.ahora();
    const corte = new Date(hoy.getTime());
    corte.setUTCDate(corte.getUTCDate() + diasHaciaAdelante);

    const planes = await this.planes.listarQueVencenHasta(corte);
    const conUrgencia = planes.map((p) => ({ ...p, ...conEstado(p, hoy) }));
    return ordenarPorUrgencia(conUrgencia) as PlanDeEquipoConEstado[];
  }

  /**
   * Adelanta el plan después de que se hizo el trabajo.
   *
   * Se cuenta desde la fecha real del trabajo y no desde la que estaba
   * planificada: un service que tocaba en marzo y se hizo en mayo tiene el
   * siguiente a los noventa días de mayo.
   */
  async adelantarDespuesDeTrabajo(planId: string, fechaDelTrabajo: Date): Promise<void> {
    const plan = await this.planes.buscarPorId(planId);
    if (!plan) return; // el plan pudo borrarse entre medio; no vale romper por eso

    await this.planes.actualizar(planId, {
      proximaFecha: proximaFechaDespuesDe(fechaDelTrabajo, plan.periodicidadDias),
    });
  }
}
