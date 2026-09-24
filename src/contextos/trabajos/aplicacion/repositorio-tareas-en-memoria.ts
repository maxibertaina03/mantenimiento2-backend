import { Rutina, Tarea } from '../dominio/tarea';
import {
  FiltroTareas,
  RepositorioTareas,
  RutinaConRelaciones,
  TareaConRelaciones,
} from '../puertos/repositorio-tareas';

/** El calendario de los tests: sin base y sin reloj del sistema. */
export class RepositorioTareasEnMemoria implements RepositorioTareas {
  private tareas: TareaConRelaciones[] = [];
  private rutinas: RutinaConRelaciones[] = [];
  private contador = 0;

  private conNombres<T extends Tarea>(tarea: T): TareaConRelaciones {
    return {
      ...tarea,
      asignadoANombre: tarea.asignadoAId ? `Usuario ${tarea.asignadoAId}` : null,
      equipoNombre: tarea.equipoId ? `Equipo ${tarea.equipoId}` : null,
      equipoItNombre: tarea.equipoItId ? `Equipo IT ${tarea.equipoItId}` : null,
      planNombre: tarea.planId ? `Plan ${tarea.planId}` : null,
      rutinaTitulo: tarea.rutinaId ? `Rutina ${tarea.rutinaId}` : null,
      ordenTrabajoNumero: tarea.ordenTrabajoId ? `OT-${tarea.ordenTrabajoId}` : null,
    };
  }

  async crear(tarea: Omit<Tarea, 'id' | 'creadoEn'>): Promise<TareaConRelaciones> {
    this.contador += 1;
    const guardada = this.conNombres({
      ...tarea,
      id: `t-${this.contador}`,
      creadoEn: new Date(),
    });
    this.tareas.push(guardada);
    return guardada;
  }

  /** Reproduce el único de la base: un plan (o rutina) genera una por día. */
  async crearSiNoExiste(tarea: Omit<Tarea, 'id' | 'creadoEn'>): Promise<boolean> {
    const mismaOrigen = (t: TareaConRelaciones) =>
      (tarea.planId !== null && t.planId === tarea.planId) ||
      (tarea.rutinaId !== null && t.rutinaId === tarea.rutinaId);

    const ya = this.tareas.some(
      (t) => mismaOrigen(t) && t.fecha.getTime() === tarea.fecha.getTime(),
    );
    if (ya) return false;

    await this.crear(tarea);
    return true;
  }

  async buscarPorId(id: string): Promise<TareaConRelaciones | null> {
    return this.tareas.find((t) => t.id === id) ?? null;
  }

  async listarEntre(desde: Date, hasta: Date, filtro: FiltroTareas): Promise<TareaConRelaciones[]> {
    return this.tareas
      .filter((t) => t.fecha >= desde && t.fecha <= hasta)
      .filter((t) => !filtro.asignadoAId || t.asignadoAId === filtro.asignadoAId)
      .filter((t) => !filtro.equipoId || t.equipoId === filtro.equipoId)
      .filter((t) => !filtro.soloPendientes || t.estado === 'PENDIENTE')
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }

  async actualizar(id: string, cambios: Partial<Tarea>): Promise<TareaConRelaciones> {
    const indice = this.tareas.findIndex((t) => t.id === id);
    if (indice === -1) throw new Error(`No existe la tarea ${id}`);
    this.tareas[indice] = this.conNombres({ ...this.tareas[indice], ...cambios });
    return this.tareas[indice];
  }

  async listarRutinas(soloActivas: boolean): Promise<RutinaConRelaciones[]> {
    return this.rutinas.filter((r) => !soloActivas || r.activa);
  }

  async crearRutina(rutina: Omit<Rutina, 'id' | 'creadoEn'>): Promise<RutinaConRelaciones> {
    this.contador += 1;
    const guardada: RutinaConRelaciones = {
      ...rutina,
      id: `r-${this.contador}`,
      creadoEn: new Date(),
      asignadoANombre: rutina.asignadoAId ? `Usuario ${rutina.asignadoAId}` : null,
      equipoNombre: rutina.equipoId ? `Equipo ${rutina.equipoId}` : null,
      equipoItNombre: rutina.equipoItId ? `Equipo IT ${rutina.equipoItId}` : null,
    };
    this.rutinas.push(guardada);
    return guardada;
  }

  async buscarRutina(id: string): Promise<RutinaConRelaciones | null> {
    return this.rutinas.find((r) => r.id === id) ?? null;
  }

  async actualizarRutina(id: string, cambios: Partial<Rutina>): Promise<RutinaConRelaciones> {
    const indice = this.rutinas.findIndex((r) => r.id === id);
    if (indice === -1) throw new Error(`No existe la rutina ${id}`);
    this.rutinas[indice] = { ...this.rutinas[indice], ...cambios };
    return this.rutinas[indice];
  }
}
