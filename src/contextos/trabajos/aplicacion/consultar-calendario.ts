import { crearTarea, ocurrenciasDeRutina, soloElDia } from '../dominio/tarea';
import { PlanesDeMantenimiento } from '../puertos/planes-de-mantenimiento';
import { FiltroTareas, RepositorioTareas, TareaConRelaciones } from '../puertos/repositorio-tareas';
import { Reloj } from '../puertos/reloj';

/**
 * Hasta dónde adelante se generan tareas.
 *
 * Existe porque el calendario las crea al leerlo, y sin tope alguien que
 * navegue hasta 2030 dejaría miles de filas de rutinas diarias que nadie pidió.
 * Tres meses alcanza para planificar y es poco para ensuciar.
 */
const HORIZONTE_DIAS = 90;

const UN_DIA_MS = 24 * 60 * 60 * 1000;

export interface Calendario {
  desde: Date;
  hasta: Date;
  tareas: TareaConRelaciones[];
}

/**
 * El calendario: qué hay que hacer entre dos fechas.
 *
 * Las tareas se generan al leerlo, no por un proceso que corre de noche. Es a
 * propósito: un proceso nocturno que falla deja el calendario vacío y nadie se
 * entera hasta que alguien pregunta por qué no le aparece nada. Generarlas al
 * abrir hace que el calendario siempre esté al día, y la base impide duplicar
 * con un único por plan y día.
 *
 * El precio es que una lectura escribe, que no es bonito. A cambio no hay nada
 * que monitorear.
 */
export class ConsultarCalendario {
  constructor(
    private readonly repo: RepositorioTareas,
    private readonly planes: PlanesDeMantenimiento,
    private readonly reloj: Reloj,
  ) {}

  async entre(desde: Date, hasta: Date, filtro: FiltroTareas = {}): Promise<Calendario> {
    const inicio = soloElDia(desde);
    const fin = soloElDia(hasta);

    await this.generar(inicio, fin);

    return { desde: inicio, hasta: fin, tareas: await this.repo.listarEntre(inicio, fin, filtro) };
  }

  /** Lo que tiene que hacer una persona hoy, para la pantalla de inicio. */
  async deHoy(asignadoAId: string): Promise<TareaConRelaciones[]> {
    const hoy = soloElDia(this.reloj.ahora());
    // Se mira desde bastante atrás: lo que venció y no se hizo sigue habiendo
    // que hacerlo, y esconderlo no lo resuelve.
    const desde = new Date(hoy.getTime() - 30 * UN_DIA_MS);
    await this.generar(desde, hoy);

    return this.repo.listarEntre(desde, hoy, { asignadoAId, soloPendientes: true });
  }

  /**
   * Materializa las tareas de los planes y las rutinas que caen en el rango.
   *
   * Recorta al horizonte, y no genera nada hacia atrás de hoy: una rutina
   * diaria creada hoy no tiene que inventar los trescientos días del año
   * pasado solo porque alguien mire enero.
   */
  private async generar(desde: Date, hasta: Date): Promise<void> {
    const hoy = soloElDia(this.reloj.ahora());
    const inicio = new Date(Math.max(desde.getTime(), hoy.getTime() - 30 * UN_DIA_MS));
    const fin = new Date(Math.min(hasta.getTime(), hoy.getTime() + HORIZONTE_DIAS * UN_DIA_MS));
    if (fin.getTime() < inicio.getTime()) return;

    for (const vencimiento of await this.planes.vencimientosEntre(inicio, fin)) {
      await this.repo.crearSiNoExiste(
        crearTarea({
          titulo: vencimiento.nombre,
          descripcion: vencimiento.tareas,
          fecha: vencimiento.fecha,
          equipoId: vencimiento.equipoId,
          planId: vencimiento.planId,
        }),
      );
    }

    for (const rutina of await this.repo.listarRutinas(true)) {
      for (const fecha of ocurrenciasDeRutina(rutina, inicio, fin)) {
        await this.repo.crearSiNoExiste(
          crearTarea({
            titulo: rutina.titulo,
            descripcion: rutina.descripcion,
            fecha,
            equipoId: rutina.equipoId,
            rutinaId: rutina.id,
            // La rutina puede tener dueño fijo; si no, cada repetición nace sin
            // repartir y alguien la reparte.
            asignadoAId: rutina.asignadoAId,
          }),
        );
      }
    }
  }
}
