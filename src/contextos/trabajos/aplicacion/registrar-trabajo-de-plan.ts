import { cerrarPorTrabajoRegistrado } from '../dominio/tarea';
import { PlanesDeMantenimiento } from '../puertos/planes-de-mantenimiento';
import { RepositorioTareas, TareaConRelaciones } from '../puertos/repositorio-tareas';

/** Lo que hace falta saber de la orden que se acaba de cerrar. */
export interface OrdenCerrada {
  id: string;
  estado: string;
  planId: string | null;
  /** La fecha real del trabajo: el plan cuenta desde acá. */
  fecha: Date;
  cerradaPorId: string | null;
  asignadoAId: string | null;
}

export interface OpcionesTrabajoDePlan {
  /**
   * Quien llama ya cierra la tarea del calendario que este trabajo explica:
   * es «dar por hecha» una tarea, que crea la orden y después cierra la suya.
   * Ahí no hay que buscar otra.
   */
  cierraSuPropiaTarea?: boolean;
}

/** Desde siempre y hasta muy lejos: la tarea de un plan puede estar en cualquier fecha. */
const DESDE_SIEMPRE = new Date(0);
const HASTA_MUY_LEJOS = new Date('2100-01-01T00:00:00.000Z');

/**
 * Se hizo el trabajo de un plan de mantenimiento: es el único lugar que sabe
 * qué pasa entonces. Dos cosas, siempre juntas y en este orden:
 *
 * 1. **El plan corre** a la próxima fecha, contada desde la fecha real del
 *    trabajo. La cuenta es del contexto de equipos; acá solo se le avisa.
 * 2. **La tarea del calendario de ese service queda hecha**, atada a la orden
 *    que la explica. Antes, un service registrado desde la ficha del equipo
 *    corría el plan pero dejaba la tarea pendiente —vencida— por un trabajo que
 *    ya estaba hecho.
 *
 * Lo llama la orden de trabajo cuando se cierra, venga de donde venga: la
 * pantalla de órdenes, la ficha del equipo o el calendario. Antes estaba
 * repartido entre el caso de uso de las órdenes y el controlador HTTP, y un
 * camino nuevo podía olvidarse de la mitad.
 *
 * Se cierra la pendiente más vieja del plan: el calendario genera una sola, la
 * del vencimiento vigente, así que en la práctica es esa. Una orden que ya
 * cerró una tarea no cierra otra: pasa si se reabre y se vuelve a cerrar. Una
 * orden explica una sola tarea.
 */
export class RegistrarTrabajoDePlan {
  constructor(
    private readonly planes: PlanesDeMantenimiento,
    private readonly tareas: RepositorioTareas,
  ) {}

  async ejecutar(
    orden: OrdenCerrada,
    opciones: OpcionesTrabajoDePlan = {},
  ): Promise<TareaConRelaciones | null> {
    if (orden.estado !== 'CERRADA' || !orden.planId) return null;

    await this.planes.registrarTrabajo(orden.planId, orden.fecha);

    if (opciones.cierraSuPropiaTarea) return null;
    return this.cerrarTareaPendiente(orden, orden.planId);
  }

  private async cerrarTareaPendiente(
    orden: OrdenCerrada,
    planId: string,
  ): Promise<TareaConRelaciones | null> {
    const yaExplicaUna = await this.tareas.listarEntre(DESDE_SIEMPRE, HASTA_MUY_LEJOS, {
      ordenTrabajoId: orden.id,
    });
    if (yaExplicaUna.length > 0) return null;

    const [pendiente] = await this.tareas.listarEntre(DESDE_SIEMPRE, HASTA_MUY_LEJOS, {
      planId,
      soloPendientes: true,
    });
    if (!pendiente) return null;

    return this.tareas.actualizar(
      pendiente.id,
      cerrarPorTrabajoRegistrado(pendiente, orden.id, orden.cerradaPorId ?? orden.asignadoAId),
    );
  }
}
