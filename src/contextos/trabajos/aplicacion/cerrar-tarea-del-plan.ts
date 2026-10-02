import { cerrarPorTrabajoRegistrado } from '../dominio/tarea';
import { RepositorioTareas, TareaConRelaciones } from '../puertos/repositorio-tareas';

/** Lo que hace falta saber de la orden que se acaba de cerrar. */
export interface OrdenCerrada {
  id: string;
  estado: string;
  planId: string | null;
  cerradaPorId: string | null;
  asignadoAId: string | null;
}

/** Desde siempre y hasta muy lejos: la tarea de un plan puede estar en cualquier fecha. */
const DESDE_SIEMPRE = new Date(0);
const HASTA_MUY_LEJOS = new Date('2100-01-01T00:00:00.000Z');

/**
 * Cuando un trabajo de un plan se registra por fuera del calendario, cierra la
 * tarea que el calendario tenía pendiente para ese plan.
 *
 * Pasaba con «Registrar trabajo» en la ficha de un equipo: el plan corría a la
 * próxima fecha, pero la tarea del calendario quedaba pendiente —vencida— por
 * un trabajo que ya estaba hecho. Ahora queda hecha, atada a la orden que la
 * explica, igual que si la hubieran dado por hecha desde el calendario.
 *
 * Se cierra la pendiente más vieja del plan: el calendario genera una sola, la
 * del vencimiento vigente, así que en la práctica es esa.
 *
 * NO va en el camino de «dar por hecha» una tarea, que ya cierra la suya. Y una
 * orden que ya cerró una tarea no cierra otra: pasa si se reabre y se vuelve a
 * cerrar. Las dos cosas por lo mismo: una orden explica una sola tarea.
 */
export class CerrarTareaDelPlan {
  constructor(private readonly tareas: RepositorioTareas) {}

  async ejecutar(orden: OrdenCerrada): Promise<TareaConRelaciones | null> {
    if (orden.estado !== 'CERRADA' || !orden.planId) return null;

    const yaExplicaUna = await this.tareas.listarEntre(DESDE_SIEMPRE, HASTA_MUY_LEJOS, {
      ordenTrabajoId: orden.id,
    });
    if (yaExplicaUna.length > 0) return null;

    const [pendiente] = await this.tareas.listarEntre(DESDE_SIEMPRE, HASTA_MUY_LEJOS, {
      planId: orden.planId,
      soloPendientes: true,
    });
    if (!pendiente) return null;

    return this.tareas.actualizar(
      pendiente.id,
      cerrarPorTrabajoRegistrado(pendiente, orden.id, orden.cerradaPorId ?? orden.asignadoAId),
    );
  }
}
