import { Rutina, Tarea } from '../dominio/tarea';

/** Una tarea con los nombres ya resueltos, lista para el calendario. */
export interface TareaConRelaciones extends Tarea {
  asignadoANombre: string | null;
  equipoNombre: string | null;
  planNombre: string | null;
  rutinaTitulo: string | null;
  ordenTrabajoNumero: string | null;
}

export interface RutinaConRelaciones extends Rutina {
  asignadoANombre: string | null;
  equipoNombre: string | null;
}

export interface FiltroTareas {
  asignadoAId?: string;
  equipoId?: string;
  /** Por defecto vienen todas; sirve para ver solo lo que falta hacer. */
  soloPendientes?: boolean;
}

export interface RepositorioTareas {
  crear(tarea: Omit<Tarea, 'id' | 'creadoEn'>): Promise<TareaConRelaciones>;

  /**
   * Crea la tarea si no existe ya una para ese plan (o rutina) y ese día.
   *
   * Devuelve `false` si ya estaba. Es lo que permite generar el calendario al
   * abrirlo tantas veces como haga falta sin duplicar nada: la base tiene el
   * único, así que dos personas abriéndolo a la vez tampoco lo rompen.
   */
  crearSiNoExiste(tarea: Omit<Tarea, 'id' | 'creadoEn'>): Promise<boolean>;

  buscarPorId(id: string): Promise<TareaConRelaciones | null>;
  listarEntre(desde: Date, hasta: Date, filtro: FiltroTareas): Promise<TareaConRelaciones[]>;
  actualizar(id: string, cambios: Partial<Tarea>): Promise<TareaConRelaciones>;

  listarRutinas(soloActivas: boolean): Promise<RutinaConRelaciones[]>;
  crearRutina(rutina: Omit<Rutina, 'id' | 'creadoEn'>): Promise<RutinaConRelaciones>;
  buscarRutina(id: string): Promise<RutinaConRelaciones | null>;
  actualizarRutina(id: string, cambios: Partial<Rutina>): Promise<RutinaConRelaciones>;
}

export const REPOSITORIO_TAREAS = Symbol('RepositorioTareas');
