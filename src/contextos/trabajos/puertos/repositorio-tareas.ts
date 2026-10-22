import { Postergacion, Rutina, Tarea } from '../dominio/tarea';

/** Una postergación ya registrada, con quién la hizo. */
export interface PostergacionRegistrada extends Postergacion {
  usuarioNombre: string | null;
  creadoEn: Date;
}

/** Una tarea con los nombres ya resueltos, lista para el calendario. */
export interface TareaConRelaciones extends Tarea {
  asignadoANombre: string | null;
  equipoNombre: string | null;
  equipoItNombre: string | null;
  planNombre: string | null;
  rutinaTitulo: string | null;
  /**
   * Cada cuántos días se repite: la del plan o la de la rutina. Vacía si se
   * programó a mano. Con 1, es de todos los días: el calendario y Hoy las
   * juntan aparte para que no tapen lo importante.
   */
  cadaDias: number | null;
  ordenTrabajoNumero: string | null;
  /** Las veces que se postergó, de la primera a la última. */
  postergaciones: PostergacionRegistrada[];
}

export interface RutinaConRelaciones extends Rutina {
  asignadoANombre: string | null;
  equipoNombre: string | null;
  equipoItNombre: string | null;
}

export interface FiltroTareas {
  asignadoAId?: string;
  /**
   * Con `asignadoAId`: también las que no son de nadie. Una sin responsable la
   * puede hacer cualquiera de mantenimiento, así que es de todos.
   */
  oSinAsignar?: boolean;
  planId?: string;
  /** La tarea que explica esa orden de trabajo, si hay una. */
  ordenTrabajoId?: string;
  equipoId?: string;
  equipoItId?: string;
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

  /** Mueve la tarea y deja asentado el porqué, las dos cosas juntas. */
  postergar(
    id: string,
    cambios: Pick<Tarea, 'fecha' | 'fechaOriginal'>,
    postergacion: Postergacion,
    usuarioId: string | null,
  ): Promise<TareaConRelaciones>;

  listarRutinas(soloActivas: boolean): Promise<RutinaConRelaciones[]>;
  crearRutina(rutina: Omit<Rutina, 'id' | 'creadoEn'>): Promise<RutinaConRelaciones>;
  buscarRutina(id: string): Promise<RutinaConRelaciones | null>;
  actualizarRutina(id: string, cambios: Partial<Rutina>): Promise<RutinaConRelaciones>;
}

export const REPOSITORIO_TAREAS = Symbol('RepositorioTareas');
